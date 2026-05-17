import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        let settings = await prisma.settings.findUnique({ where: { id: 'default' } });
        if (!settings) {
            settings = await prisma.settings.create({
                data: { id: 'default', openaiKeys: [] }
            });
        }
        return json(settings);
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const body = await request.json();
        const settings = await prisma.settings.upsert({
            where: { id: 'default' },
            update: {
                openaiBaseUrl: body.openaiBaseUrl,
                openaiKeys: body.openaiKeys
            },
            create: {
                id: 'default',
                openaiBaseUrl: body.openaiBaseUrl,
                openaiKeys: body.openaiKeys || []
            }
        });
        return json(settings);
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}
