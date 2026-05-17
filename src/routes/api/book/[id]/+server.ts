import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function DELETE({ params }) {
    try {
        const bookId = params.id;
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        
        if (book) {
            const localPath = path.join(UPLOADS_DIR, book.localPath);
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
            await prisma.book.delete({ where: { id: bookId } });
        }
        
        return json({ success: true });
    } catch (error: any) {
        return json({ error: error.message }, { status: 500 });
    }
}
