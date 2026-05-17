import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function DELETE({ params }) {
    try {
        const bookId = params.id;
        const foundBook = await db.query.book.findFirst({ where: eq(book.id, bookId) });
        
        if (foundBook) {
            const localPath = path.join(UPLOADS_DIR, foundBook.localPath);
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
            await db.delete(book).where(eq(book.id, bookId));
        }
        
        return json({ success: true });
    } catch (error: any) {
        return json({ error: error.message }, { status: 500 });
    }
}
