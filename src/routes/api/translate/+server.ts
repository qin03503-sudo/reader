import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { translationCache, settings } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { createHash } from 'node:crypto';


type TranslationResult = {
    original_html_with_spans: string;
    translated_html_with_spans: string;
};

type ProtectedBlock = {
    token: string;
    html: string;
};

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

function splitHtmlIntoTranslatableParts(html: string, maxPartLength = 2500): string[] {
    const blockRegex = /(<(?:p|div|section|article|blockquote|h[1-6]|li|pre|code|table|figure)[^>]*>[\s\S]*?<\/(?:p|div|section|article|blockquote|h[1-6]|li|pre|code|table|figure)>)/gi;
    const blocks = html.match(blockRegex);

    if (!blocks || blocks.length === 0) {
        return [html];
    }

    const parts: string[] = [];
    let current = '';

    for (const block of blocks) {
        if (current.length > 0 && current.length + block.length > maxPartLength) {
            parts.push(current);
            current = block;
            continue;
        }

        current += block;
    }

    if (current) {
        parts.push(current);
    }

    return parts;
}

function hashPart(partHtml: string, targetLanguage: string, model: string): string {
    return createHash('sha256').update(`${model}::${targetLanguage}::${partHtml}`).digest('hex');
}

function protectNonTranslatableBlocks(html: string): { sanitizedHtml: string; blocks: ProtectedBlock[] } {
    const blocks: ProtectedBlock[] = [];
    let index = 0;
    const blockRegex = /<(table|figure)\b[\s\S]*?<\/\1>|<img\b[^>]*\/?>/gi;
    const sanitizedHtml = html.replace(blockRegex, (match) => {
        const token = `__NON_TRANSLATABLE_BLOCK_${index++}__`;
        blocks.push({ token, html: match });
        return `<span data-non-translatable="${token}"></span>`;
    });
    return { sanitizedHtml, blocks };
}

function restoreProtectedBlocks(html: string, blocks: ProtectedBlock[]): string {
    return blocks.reduce((acc, block) => {
        const placeholder = `<span data-non-translatable="${block.token}"></span>`;
        return acc.split(placeholder).join(block.html);
    }, html);
}

function buildPrompt(partHtml: string, targetLanguage: string, bookTitle?: string, chapterTitle?: string) {
    return `You are an expert bilingual e-book translator.
Target Language: ${targetLanguage}
Book Title: ${bookTitle || 'Unknown'}
Chapter Title: ${chapterTitle || 'Unknown'}

Task:
1. Identify logical sentences within the provided HTML block.
2. Translate the text into ${targetLanguage}, preserving ALL original HTML tags (like <b>, <i>, <a>, <img>).
   - DO NOT translate the contents or attributes of <img>, <table>, or <figure> tags.
   - Keep advanced, technical, or context-specific words original if there is no direct, common translation.
3. Wrap each matching logical sentence in BOTH the original and translated HTML with a span tag: <span class="sync-hover" data-sync-id="[sentence-index]">...</span>.
Use a simple numeric index 1, 2, 3... for the data-sync-id. The sync IDs must perfectly match between the original and translated versions so they can be highlighted together. Ensure IDs are unique.

HTML Block:
${partHtml}`;
}

async function translateWithModel(model: string | undefined, currentSettings: any, prompt: string): Promise<TranslationResult> {
    if (model === 'custom') {
        if (!currentSettings || !currentSettings.openaiBaseUrl || (!currentSettings.openaiKey && (!currentSettings.openaiKeys || currentSettings.openaiKeys.length === 0))) {
            throw new Error('Custom OpenAI settings are missing.');
        }
        const url = currentSettings.openaiBaseUrl.endsWith('/') ? `${currentSettings.openaiBaseUrl}chat/completions` : `${currentSettings.openaiBaseUrl}/chat/completions`;
        const keys = currentSettings.openaiKeys && currentSettings.openaiKeys.length > 0 ? currentSettings.openaiKeys.filter((k: string) => k && k.trim() !== '') : (currentSettings.openaiKey ? [currentSettings.openaiKey] : []);
        if (keys.length === 0 || !keys[0]) throw new Error('No API keys configured.');
        const actualModel = currentSettings.openaiModel || 'deepseek-chat';

        return fetchOpenAIFormat(url, keys[0], actualModel, prompt);
    }

    if (model === 'litellm') {
        if (!currentSettings || !currentSettings.litellmBaseUrl || (!currentSettings.litellmKeys || currentSettings.litellmKeys.length === 0)) {
            throw new Error('LiteLLM settings are missing.');
        }
        const url = currentSettings.litellmBaseUrl.endsWith('/') ? `${currentSettings.litellmBaseUrl}chat/completions` : `${currentSettings.litellmBaseUrl}/chat/completions`;
        const keys = currentSettings.litellmKeys.filter((k: string) => k && k.trim() !== '');
        if (keys.length === 0 || !keys[0]) throw new Error('No LiteLLM API keys configured.');
        const actualModel = currentSettings.litellmModel || 'deepseek-chat';

        return fetchOpenAIFormat(url, keys[0], actualModel, prompt);
    }

    if (model === 'openrouter') {
        if (!currentSettings || !currentSettings.openrouterKey) {
            throw new Error('OpenRouter settings are missing.');
        }
        return fetchOpenAIFormat('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, currentSettings.openrouterModel || 'deepseek/deepseek-chat', prompt);
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if(!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: model || 'gemini-2.5-flash',
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
    return JSON.parse(response.text);
}

export async function POST({ request }) {
    const { html, targetLanguage, model, bookTitle, chapterTitle } = await request.json();

    if (!html || !targetLanguage) {
        return json({ error: 'Missing html or targetLanguage' }, { status: 400 });
    }

    try {
        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });
        const partModel = model || 'gemini-2.5-flash';
        const parts = splitHtmlIntoTranslatableParts(html);

        const translatedParts: { original: string; translated: string; }[] = [];

        for (const part of parts) {
            const { sanitizedHtml, blocks } = protectNonTranslatableBlocks(part);
            const partHash = hashPart(sanitizedHtml, targetLanguage, partModel);

            const cacheKey = `hash:${partHash}::`;
            const cached = await db.query.translationCache.findFirst({
                where: and(
                    eq(translationCache.originalHtml, cacheKey),
                    eq(translationCache.targetLanguage, targetLanguage),
                    eq(translationCache.model, partModel)
                )
            });

            if (cached) {
                translatedParts.push({ original: part, translated: cached.translatedHtml });
                continue;
            }

            const prompt = buildPrompt(sanitizedHtml, targetLanguage, bookTitle, chapterTitle);
            const result = await translateWithModel(model, currentSettings, prompt);
            const restoredOriginal = restoreProtectedBlocks(result.original_html_with_spans, blocks);
            const restoredTranslated = restoreProtectedBlocks(result.translated_html_with_spans, blocks);

            await db.insert(translationCache).values({
                originalHtml: cacheKey,
                translatedHtml: restoredTranslated,
                targetLanguage,
                model: partModel
            });

            translatedParts.push({ original: restoredOriginal, translated: restoredTranslated });
        }

        const originalHtml = translatedParts.map((p) => p.original).join('');
        const translatedHtml = translatedParts.map((p) => p.translated).join('');

        return json({ originalHtml, translatedHtml, cachedParts: translatedParts.length });
    } catch (error: any) {
        console.error("AI Translation Error:", error);
        return json({ error: error.message || 'Translation failed' }, { status: 500 });
    }
}
