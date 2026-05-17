import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book, chapter } from '$lib/server/schema';
import fs from 'fs';
import path from 'path';
import { parseEpub } from '$lib/server/epub';
import { v4 as uuidv4 } from 'uuid';
import { desc } from 'drizzle-orm';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function POST({ request }) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return json({ error: 'No file uploaded' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse EPUB to extract metadata and chapters
        const parsed = await parseEpub(buffer);
        
        // Save file locally
        const fileName = `${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const localPath = path.join(UPLOADS_DIR, fileName);
        fs.writeFileSync(localPath, buffer);

        // Save to Database
        let newBookWithChapters;

        await db.transaction(async (tx) => {
            const [newBook] = await tx.insert(book).values({
                title: parsed.metadata.title,
                author: parsed.metadata.author,
                coverUrl: parsed.metadata.coverUrl,
                localPath: fileName,
            }).returning();

            const chaptersToInsert = parsed.chapters.map(ch => ({
                href: ch.href,
                title: ch.title,
                bookId: newBook.id
            }));

            let insertedChapters: any[] = [];
            if (chaptersToInsert.length > 0) {
                insertedChapters = await tx.insert(chapter).values(chaptersToInsert).returning();
            }

            newBookWithChapters = { ...newBook, chapters: insertedChapters };
        });

        return json({ success: true, book: newBookWithChapters });
    } catch (error: any) {
        console.error("Upload error:", error);
        return json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const books = await db.query.book.findMany({
            with: { chapters: true },
            orderBy: [desc(book.createdAt)]
        });
        return json({ books });
    } catch (error: any) {
        return json({ error: error.message }, { status: 500 });
    }
}
