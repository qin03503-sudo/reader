import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { generateContentWithFallback } from '$lib/server/ai';

export async function POST({ request }) {
    const { sentence, targetLanguage, model, context } = await request.json();

    if (!sentence || !targetLanguage) {
        return json({ error: 'Missing sentence or targetLanguage' }, { status: 400 });
    }

    try {
        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });
        const maxRetries = currentSettings?.maxRetries ?? 3;
        const baseDelay = currentSettings?.baseDelay ?? 2000;
        const maxDelay = currentSettings?.maxDelay ?? 30000;

        const prompt = `You are a linguist and language tutor.
Analyze the following sentence for a native ${targetLanguage} speaker learning the original language.
Sentence: "${sentence}"
Context (if any): "${context || ''}"

Return a JSON object strictly following this structure:
{
  "translation": "High-quality translation in ${targetLanguage}",
  "grammar": "A brief explanation of the key grammatical structure used in this sentence.",
  "words": [
    {
      "word": "original word",
      "meaning": "meaning in ${targetLanguage}",
      "type": "noun/verb/adjective/etc",
      "pronunciation": "phonetic spelling if applicable"
    }
  ],
  "nuance": "Any cultural, idiomatic, or nuanced context related to the sentence."
}

Ensure the output is ONLY valid JSON.`;

        const systemPrompt = "You are an expert language teacher and linguist.";
        const analysis = await generateContentWithFallback(
            model,
            currentSettings,
            prompt,
            systemPrompt,
            true
        );

        return json(analysis);

    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        return json({ error: error.message || 'Analysis failed' }, { status: 500 });
    }
}
