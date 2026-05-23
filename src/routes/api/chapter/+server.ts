import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { getChapterHtml } from '$lib/server/epub';
import JSZip from 'jszip';
import { minioClient, bucketName } from '$lib/server/minio';
import { logger } from '$lib/server/logger';

const UPLOADS_DIR = './uploads';

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

        let buffer: Uint8Array | null = null;

        // Try MinIO first
        if (foundBook.minioKey) {
            try {
                const stream = await minioClient.getObject(bucketName, foundBook.minioKey);
                const chunks: any[] = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
                logger.debug({ minioKey: foundBook.minioKey }, 'Successfully fetched book from MinIO');
            } catch (minioError) {
                logger.error({ err: minioError, minioKey: foundBook.minioKey }, 'Failed to get book from MinIO');
            }
        }

        // Fallback to local storage
        if (!buffer) {
            const localPath = `${UPLOADS_DIR}/${foundBook.localPath}`;
            const file = Bun.file(localPath);
            if (!await file.exists()) {
                 logger.error({ bookId, localPath, minioKey: foundBook.minioKey }, 'Book file missing both locally and in MinIO');
                 return json({ error: 'Book file missing both locally and in MinIO' }, { status: 404 });
            }
            const arrayBuffer = await file.arrayBuffer();
            buffer = new Uint8Array(arrayBuffer);
            logger.debug({ localPath }, 'Fetched book from local storage');
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
