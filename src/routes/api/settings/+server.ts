import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        let currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });
        if (!currentSettings) {
            [currentSettings] = await db.insert(settings).values({
                id: 'default',
                openaiKeys: [],
                litellmKeys: [],
                openrouterKey: null
            }).returning();
        }
        return json(currentSettings);
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const body = await request.json();

        const [updatedSettings] = await db.insert(settings).values({
            id: 'default',
            openaiBaseUrl: body.openaiBaseUrl,
            openaiKeys: body.openaiKeys || [],
            litellmBaseUrl: body.litellmBaseUrl,
            litellmKeys: body.litellmKeys || [],
            openrouterKey: body.openrouterKey
        }).onConflictDoUpdate({
            target: settings.id,
            set: {
                openaiBaseUrl: body.openaiBaseUrl,
                openaiKeys: body.openaiKeys,
                litellmBaseUrl: body.litellmBaseUrl,
                litellmKeys: body.litellmKeys,
                openrouterKey: body.openrouterKey
            }
        }).returning();

        return json(updatedSettings);
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}
