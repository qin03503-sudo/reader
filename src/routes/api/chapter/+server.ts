import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getChapterHtml } from '$lib/server/epub';
import JSZip from 'jszip';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function GET({ url }) {
    const bookId = url.searchParams.get('bookId');
    const href = url.searchParams.get('href');

    if (!bookId || !href) {
        return json({ error: 'Missing bookId or href' }, { status: 400 });
    }

    try {
        const foundBook = await db.query.book.findFirst({ where: eq(book.id, bookId) });
        if (!foundBook) return json({ error: 'Book not found' }, { status: 404 });

        const localPath = path.join(UPLOADS_DIR, foundBook.localPath);
        if (!fs.existsSync(localPath)) {
             return json({ error: 'Book file missing' }, { status: 404 });
        }

        const buffer = fs.readFileSync(localPath);
        const zip = new JSZip();
        await zip.loadAsync(buffer);

        const html = await getChapterHtml(zip, href);

        return json({ html });
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}
