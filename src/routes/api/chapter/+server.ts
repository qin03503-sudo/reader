import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { getChapterHtml } from '$lib/server/epub';
import JSZip from 'jszip';
import { logger } from '$lib/server/logger';
import { StorageService } from '$lib/server/services/storage';

export async function GET({ url }) {
    const bookId = url.searchParams.get('bookId');
    const href = url.searchParams.get('href');

    if (!bookId || !href) {
        logger.warn({ bookId, href }, 'Missing bookId or href in chapter request');
        return json({ error: 'Missing bookId or href' }, { status: 400 });
    }

    try {
        const foundBook = await db.query.book.findFirst({ where: eq(book.id, bookId) });
        if (!foundBook) {
            logger.warn({ bookId }, 'Book not found');
            return json({ error: 'Book not found' }, { status: 404 });
        }

        const buffer = await StorageService.getBookFile(foundBook.minioKey, foundBook.localPath);

        if (!buffer) {
             logger.error({ bookId, localPath: foundBook.localPath, minioKey: foundBook.minioKey }, 'Book file missing both locally and in MinIO');
             return json({ error: 'Book file missing both locally and in MinIO' }, { status: 404 });
        }

        const zip = new JSZip();
        await zip.loadAsync(buffer);

        const html = await getChapterHtml(zip, href);

        logger.debug({ bookId, href, htmlLength: html.length }, 'Successfully extracted chapter HTML');
        return json({ html });
    } catch (e: any) {
        logger.error({ err: e, bookId, href }, 'Chapter GET error');
        return json({ error: e.message }, { status: 500 });
    }
}
