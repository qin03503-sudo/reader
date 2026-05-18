import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book, chapter } from '$lib/server/schema';
import { parseEpub } from '$lib/server/epub';
import { desc } from 'drizzle-orm';

const UPLOADS_DIR = './uploads';

export async function POST({ request }) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return json({ error: 'No file uploaded' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Parse EPUB to extract metadata and chapters
        const parsed = await parseEpub(buffer);
        
        // Save file locally using Bun
        const uuid = crypto.randomUUID();
        const fileName = `${uuid}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        await Bun.write(`${UPLOADS_DIR}/${fileName}`, buffer);

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
