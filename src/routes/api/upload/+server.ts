import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book, chapter } from '$lib/server/schema';
import { parseEpub } from '$lib/server/epub';
import { desc, eq } from 'drizzle-orm';
import { logger } from '$lib/server/logger';
import { StorageService } from '$lib/server/services/storage';

export async function POST({ request }) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            logger.warn('Upload attempt with no file');
            return json({ error: 'No file uploaded' }, { status: 400 });
        }

        logger.info({ fileName: file.name, fileSize: file.size }, 'Received file upload');

        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Calculate SHA-256 hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hash = Buffer.from(hashBuffer).toString('hex');

        // Check for deduplication
        const existingBook = await db.query.book.findFirst({
            where: eq(book.hash, hash),
            with: { chapters: true }
        });

        if (existingBook) {
             logger.info({ bookId: existingBook.id, hash }, 'File already exists, returning existing book');
             return json({ success: true, book: existingBook, message: 'File already exists' });
        }

        // Parse EPUB to extract metadata and chapters
        logger.debug({ fileName: file.name }, 'Parsing EPUB');
        const parsed = await parseEpub(buffer);
        
        // Save via StorageService
        const { minioKey, localPath } = await StorageService.saveBookFile(file, buffer, hash);

        // Save to Database
        let newBookWithChapters;

        await db.transaction(async (tx) => {
            const [newBook] = await tx.insert(book).values({
                title: parsed.metadata.title,
                author: parsed.metadata.author,
                coverUrl: parsed.metadata.coverUrl,
                localPath: localPath,
                hash: hash,
                minioKey: minioKey
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
            logger.info({ bookId: newBook.id, title: newBook.title, chaptersCount: chaptersToInsert.length }, 'Book saved to database');
        });

        return json({ success: true, book: newBookWithChapters });
    } catch (error: any) {
        logger.error({ err: error }, 'Upload failed');
        return json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const books = await db.query.book.findMany({
            with: { chapters: true },
            orderBy: [desc(book.createdAt)]
        });
        logger.debug({ count: books.length }, 'Fetched books list');
        return json({ books });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch books list');
        return json({ error: error.message }, { status: 500 });
    }
}
