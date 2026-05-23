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
                openrouterKey: null,
                openaiModel: 'deepseek-chat',
                litellmModel: 'deepseek-chat',
                mistralKeys: [],
                mistralModel: 'mistral-large-latest',
                openrouterModel: 'deepseek/deepseek-chat',
                defaultModel: 'gemini-2.5-flash'
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
            openaiModel: body.openaiModel || 'deepseek-chat',
            litellmBaseUrl: body.litellmBaseUrl,
            litellmKeys: body.litellmKeys || [],
            litellmModel: body.litellmModel || 'deepseek-chat',
            mistralBaseUrl: body.mistralBaseUrl,
            mistralKeys: body.mistralKeys || [],
            mistralModel: body.mistralModel || 'mistral-large-latest',
            openrouterKey: body.openrouterKey,
            openrouterModel: body.openrouterModel || 'deepseek/deepseek-chat',
            defaultModel: body.defaultModel || 'gemini-2.5-flash'
        }).onConflictDoUpdate({
            target: settings.id,
            set: {
                openaiBaseUrl: body.openaiBaseUrl,
                openaiKeys: body.openaiKeys,
                openaiModel: body.openaiModel,
                litellmBaseUrl: body.litellmBaseUrl,
                litellmKeys: body.litellmKeys,
                litellmModel: body.litellmModel,
                mistralBaseUrl: body.mistralBaseUrl,
                mistralKeys: body.mistralKeys,
                mistralModel: body.mistralModel,
                openrouterKey: body.openrouterKey,
                openrouterModel: body.openrouterModel,
                defaultModel: body.defaultModel
            }
        }).returning();

        return json(updatedSettings);
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}
