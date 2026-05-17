import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parseEpub } from '$lib/server/epub';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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
        const book = await prisma.book.create({
            data: {
                title: parsed.metadata.title,
                author: parsed.metadata.author,
                coverUrl: parsed.metadata.coverUrl,
                localPath: fileName,
                chapters: {
                    create: parsed.chapters.map(ch => ({
                        href: ch.href,
                        title: ch.title
                    }))
                }
            },
            include: {
                chapters: true
            }
        });

        return json({ success: true, book });
    } catch (error: any) {
        console.error("Upload error:", error);
        return json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const books = await prisma.book.findMany({
            include: { chapters: true },
            orderBy: { createdAt: 'desc' }
        });
        return json({ books });
    } catch (error: any) {
        return json({ error: error.message }, { status: 500 });
    }
}
