import { db } from '$lib/server/db';
import { settings, book } from '$lib/server/schema';
import { eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
    if (env.VITE_TESTING === 'true') {
        return { defaultModel: 'gemini-2.5-flash', settings: {}, books: [] };
    }
    try {
        let currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });

        const books = await db.query.book.findMany({
            with: { chapters: true },
            orderBy: [desc(book.createdAt)]
        });

        return {
            defaultModel: currentSettings?.defaultModel || 'gemini-2.5-flash',
            settings: currentSettings || {},
            books
        };
    } catch (e: any) {
        console.error("Failed to load data on SSR:", e.message);
        return {
            defaultModel: 'gemini-2.5-flash',
            settings: {},
            books: []
        };
    }
};
