import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const UPLOADS_DIR = './uploads';

export async function DELETE({ params }) {
    try {
        const bookId = params.id;
        const foundBook = await db.query.book.findFirst({ where: eq(book.id, bookId) });
        
        if (foundBook) {
            const localPath = `${UPLOADS_DIR}/${foundBook.localPath}`;
            if (existsSync(localPath)) {
                await unlink(localPath);
            }
            await db.delete(book).where(eq(book.id, bookId));
        }
        
        return json({ success: true });
    } catch (error: any) {
        return json({ error: error.message }, { status: 500 });
    }
}
