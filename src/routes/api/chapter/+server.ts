import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { getChapterHtml } from '$lib/server/epub';
import JSZip from 'jszip';

const UPLOADS_DIR = './uploads';

export async function GET({ url }) {
    const bookId = url.searchParams.get('bookId');
    const href = url.searchParams.get('href');

    if (!bookId || !href) {
        return json({ error: 'Missing bookId or href' }, { status: 400 });
    }

    try {
        const foundBook = await db.query.book.findFirst({ where: eq(book.id, bookId) });
        if (!foundBook) return json({ error: 'Book not found' }, { status: 404 });

        const localPath = `${UPLOADS_DIR}/${foundBook.localPath}`;
        const file = Bun.file(localPath);
        if (!await file.exists()) {
             return json({ error: 'Book file missing' }, { status: 404 });
        }

        const buffer = await file.arrayBuffer();
        const zip = new JSZip();
        await zip.loadAsync(buffer);

        const html = await getChapterHtml(zip, href);

        return json({ html });
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}
