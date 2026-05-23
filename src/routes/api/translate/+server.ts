import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { translationCache, settings } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { chunkHtmlByLength } from '$lib/server/domUtils';


async function fetchOpenAIFormat(url: string, key: string, model: string, prompt: string) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: "You are an expert translator that precisely aligns HTML sentences." },
                { role: "user", content: prompt }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "translation_result",
                    strict: false,
                    schema: {
                        type: "object",
                        properties: {
                            original_html_with_spans: { type: "string" },
                            translated_html_with_spans: { type: "string" }
                        },
                        required: ["original_html_with_spans", "translated_html_with_spans"]
                    }
                }
            },
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("No response text from model");

    return JSON.parse(content);
}

export async function POST({ request }) {
    const { html, targetLanguage, model, bookTitle, chapterTitle } = await request.json();

    if (!html || !targetLanguage) {
        return json({ error: 'Missing html or targetLanguage' }, { status: 400 });
    }

    try {
        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });
        const actualModel = model || 'gemini-2.5-flash';

        // Split HTML into chunks to avoid context limits and process efficiently
        const chunks = chunkHtmlByLength(html, 4000);
        let finalOriginalHtml = '';
        let finalTranslatedHtml = '';

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Check cache first for this specific chunk
            const cached = await db.query.translationCache.findFirst({
                where: and(
                    eq(translationCache.originalHtml, chunk),
                    eq(translationCache.targetLanguage, targetLanguage),
                    eq(translationCache.model, actualModel)
                )
            });

            if (cached) {
                finalOriginalHtml += cached.originalHtml;
                finalTranslatedHtml += cached.translatedHtml;
                continue;
            }

            const prompt = `You are an expert bilingual e-book translator.
Target Language: ${targetLanguage}
Book Title: ${bookTitle || 'Unknown'}
Chapter Title: ${chapterTitle || 'Unknown'}

Task:
1. Identify logical sentences within the provided HTML block.
2. Translate the text into ${targetLanguage}, preserving ALL original HTML tags (like <b>, <i>, <a>, <img>).
   - DO NOT translate the contents or attributes of <img>, <table>, or <figure> tags.
   - Keep advanced, technical, or context-specific words original if there is no direct, common translation.
3. Wrap each matching logical sentence in BOTH the original and translated HTML with a span tag: <span class="sync-hover" data-sync-id="${i}-[sentence-index]">...</span>.
Use a simple numeric index 1, 2, 3... for the [sentence-index]. Ensure IDs are unique within this block.

HTML Block:
${chunk}`;

            let chunkOriginalHtml = chunk;
            let chunkTranslatedHtml = '';

            if (actualModel === 'custom' || actualModel?.startsWith('custom:')) {
                let url = '';
                let key = '';
                const m = actualModel.startsWith('custom:') ? actualModel.replace('custom:', '') : (currentSettings?.openaiModel || 'deepseek-chat');

                if (!currentSettings || !currentSettings.openaiBaseUrl || (!currentSettings.openaiKey && (!currentSettings.openaiKeys || currentSettings.openaiKeys.length === 0))) {
                    return json({ error: 'Custom OpenAI settings are missing.' }, { status: 400 });
                }
                url = currentSettings.openaiBaseUrl.endsWith('/') ? `${currentSettings.openaiBaseUrl}chat/completions` : `${currentSettings.openaiBaseUrl}/chat/completions`;
                const keys = currentSettings.openaiKeys && currentSettings.openaiKeys.length > 0 ? currentSettings.openaiKeys.filter((k) => k && k.trim() !== '') : (currentSettings.openaiKey ? [currentSettings.openaiKey] : []);
                if (keys.length === 0 || !keys[0]) return json({ error: 'No API keys configured.' }, { status: 400 });
                key = keys[0];

                const parsed = await fetchOpenAIFormat(url, key, m, prompt);
                chunkOriginalHtml = parsed.original_html_with_spans;
                chunkTranslatedHtml = parsed.translated_html_with_spans;

            } else if (actualModel === 'litellm' || actualModel?.startsWith('litellm:')) {
                let url = '';
                let key = '';
                const m = actualModel.startsWith('litellm:') ? actualModel.replace('litellm:', '') : (currentSettings?.litellmModel || 'deepseek-chat');

                if (!currentSettings || !currentSettings.litellmBaseUrl || (!currentSettings.litellmKeys || currentSettings.litellmKeys.length === 0)) {
                    return json({ error: 'LiteLLM settings are missing.' }, { status: 400 });
                }
                url = currentSettings.litellmBaseUrl.endsWith('/') ? `${currentSettings.litellmBaseUrl}chat/completions` : `${currentSettings.litellmBaseUrl}/chat/completions`;
                const keys = currentSettings.litellmKeys.filter((k) => k && k.trim() !== '');
                if (keys.length === 0 || !keys[0]) return json({ error: 'No LiteLLM API keys configured.' }, { status: 400 });
                key = keys[0];

                const parsed = await fetchOpenAIFormat(url, key, m, prompt);
                chunkOriginalHtml = parsed.original_html_with_spans;
                chunkTranslatedHtml = parsed.translated_html_with_spans;
            } else if (actualModel === 'openrouter' || actualModel?.startsWith('openrouter:')) {
                 let url = 'https://openrouter.ai/api/v1/chat/completions';
                 let key = '';
                 const m = actualModel.startsWith('openrouter:') ? actualModel.replace('openrouter:', '') : (currentSettings?.openrouterModel || 'deepseek/deepseek-chat');

                 if (!currentSettings || !currentSettings.openrouterKey) {
                    return json({ error: 'OpenRouter settings are missing.' }, { status: 400 });
                }
                key = currentSettings.openrouterKey;

                const parsed = await fetchOpenAIFormat(url, key, m, prompt);
                chunkOriginalHtml = parsed.original_html_with_spans;
                chunkTranslatedHtml = parsed.translated_html_with_spans;
            } else {
                 const apiKey = process.env.GEMINI_API_KEY || '';
                 if(!apiKey) {
                     return json({ error: 'GEMINI_API_KEY environment variable is not set.'}, { status: 500 });
                 }

                 const ai = new GoogleGenAI({ apiKey });
                 const response = await ai.models.generateContent({
                    model: actualModel,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                original_html_with_spans: { type: "STRING" },
                                translated_html_with_spans: { type: "STRING" }
                            },
                            required: ["original_html_with_spans", "translated_html_with_spans"]
                        },
                        temperature: 0.1,
                    }
                });

                if (!response.text) throw new Error("No response text");
                const data = JSON.parse(response.text);
                chunkOriginalHtml = data.original_html_with_spans;
                chunkTranslatedHtml = data.translated_html_with_spans;
            }

            // Cache the chunk result
            await db.insert(translationCache).values({
                originalHtml: chunk,
                translatedHtml: chunkTranslatedHtml,
                targetLanguage,
                model: actualModel
            });

            finalOriginalHtml += chunkOriginalHtml;
            finalTranslatedHtml += chunkTranslatedHtml;
        }

        return json({ originalHtml: finalOriginalHtml, translatedHtml: finalTranslatedHtml });

    } catch (error: any) {
        console.error("AI Translation Error:", error);
        return json({ error: error.message || 'Translation failed' }, { status: 500 });
    }
}
