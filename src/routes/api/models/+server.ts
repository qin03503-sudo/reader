import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });

        let models = [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'custom:deepseek-chat', name: 'DeepSeek V3 (Custom)' },
            { id: 'custom:deepseek-reasoner', name: 'DeepSeek R1 (Custom)' }
        ];

        if (currentSettings?.openRouterKey) {
            try {
                const res = await fetch("https://openrouter.ai/api/v1/models", {
                    headers: {
                        "Authorization": `Bearer ${currentSettings.openRouterKey}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.data && Array.isArray(data.data)) {
                        const openRouterModels = data.data.map((m: any) => ({
                            id: `openrouter:${m.id}`,
                            name: `${m.name} (OpenRouter)`
                        }));
                        models = [...models, ...openRouterModels];
                    }
                }
            } catch (err) {
                console.error("Failed to fetch OpenRouter models:", err);
            }
        }

        return json({ models });
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
}
