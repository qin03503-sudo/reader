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

async function fetchOpenAIFormat(url: string, key: string, model: string, prompt: string, maxRetries: number = 3, baseDelay: number = 2000, maxDelay: number = 30000) {
    let retries = maxRetries;
    let delay = baseDelay;

    while (retries > 0) {
        try {
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

                if (response.status === 429 || response.status >= 500) {
                    throw new Error(`Rate limit or server error (${response.status}): ${errText}`);
                }
                throw new Error(`API Error: ${errText}`);
            }

            const data = await response.json();

            if (data?.error) {
                throw new Error(data.error.message ? `API Error: ${data.error.message}` : `API Error: ${JSON.stringify(data.error)}`);
            }
            const content =
                data?.choices?.[0]?.message?.content ??
                data?.choices?.[0]?.text ??
                data?.output?.[0]?.content?.find?.((item: any) => item?.type === 'output_text')?.text ??
                data?.response?.output_text;

            if (!content || typeof content !== 'string') {
                throw new Error(`Unexpected translation API response shape: ${JSON.stringify(data).slice(0, 600)}`);
            }

            try {
                return JSON.parse(content);
            } catch {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('Model response was not valid JSON.');
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error: any) {
            if (retries === 0) {
                throw error;
            }
            console.warn(`Translation API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay = Math.min(delay * 2, maxDelay); // Exponential backoff with max
        }
    }
    throw new Error("Max retries reached");
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
    const maxRetries = currentSettings?.maxRetries ?? 3;
    const baseDelay = currentSettings?.baseDelay ?? 2000;
    const maxDelay = currentSettings?.maxDelay ?? 30000;
    if (model === 'custom' || model?.startsWith('custom:')) {
        if (!currentSettings || !currentSettings.openaiBaseUrl || (!currentSettings.openaiKey && (!currentSettings.openaiKeys || currentSettings.openaiKeys.length === 0))) {
            throw new Error('Custom OpenAI settings are missing.');
        }
        const url = currentSettings.openaiBaseUrl.endsWith('/') ? `${currentSettings.openaiBaseUrl}chat/completions` : `${currentSettings.openaiBaseUrl}/chat/completions`;
        const keys = currentSettings.openaiKeys && currentSettings.openaiKeys.length > 0 ? currentSettings.openaiKeys.filter((k: string) => k && k.trim() !== '') : (currentSettings.openaiKey ? [currentSettings.openaiKey] : []);
        if (keys.length === 0 || !keys[0]) throw new Error('No API keys configured.');
        const actualModel = (model === 'custom' ? '' : model.replace('custom:', '')) || currentSettings.openaiModel || 'deepseek-chat';

        return fetchOpenAIFormat(url, keys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);
    }

    if (model === 'litellm' || model?.startsWith('litellm:')) {
        if (!currentSettings || !currentSettings.litellmBaseUrl || (!currentSettings.litellmKeys || currentSettings.litellmKeys.length === 0)) {
            throw new Error('LiteLLM settings are missing.');
        }
        const url = currentSettings.litellmBaseUrl.endsWith('/') ? `${currentSettings.litellmBaseUrl}chat/completions` : `${currentSettings.litellmBaseUrl}/chat/completions`;
        const keys = currentSettings.litellmKeys.filter((k: string) => k && k.trim() !== '');
        if (keys.length === 0 || !keys[0]) throw new Error('No LiteLLM API keys configured.');
        const actualModel = (model === 'litellm' ? '' : model.replace('litellm:', '')) || currentSettings.litellmModel || 'deepseek-chat';

        return fetchOpenAIFormat(url, keys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);
    }

    if (model === 'openrouter' || model?.startsWith('openrouter:')) {
        if (!currentSettings || !currentSettings.openrouterKey) {
            throw new Error('OpenRouter settings are missing.');
        }
        const actualModel = (model === 'openrouter' ? '' : model.replace('openrouter:', '')) || currentSettings.openrouterModel || 'deepseek/deepseek-chat';
        return fetchOpenAIFormat('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt, maxRetries, baseDelay, maxDelay);
    }

    if (model === 'mistral' || model?.startsWith('mistral:')) {
        if (!currentSettings || (!currentSettings.mistralKeys || currentSettings.mistralKeys.length === 0)) {
            throw new Error('Mistral settings are missing.');
        }
        const baseUrl = currentSettings.mistralBaseUrl || 'https://api.mistral.ai/v1';
        const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        const keys = currentSettings.mistralKeys.filter((k: string) => k && k.trim() !== '');
        if (keys.length === 0 || !keys[0]) throw new Error('No Mistral API keys configured.');
        const actualModel = (model === 'mistral' ? '' : model.replace('mistral:', '')) || currentSettings.mistralModel || 'mistral-large-latest';

        return fetchOpenAIFormat(url, keys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if(!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set.');
    }

        const ai = new GoogleGenAI({ apiKey });

    let retries = maxRetries;
    let delay = baseDelay;

    while (retries > 0) {
        try {
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

            try {
                return JSON.parse(response.text);
            } catch {
                const jsonMatch = response.text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('Model response was not valid JSON.');
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error: any) {
            if (retries === 1) {
                throw error;
            }
            console.warn(`Gemini API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries - 1})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay = Math.min(delay * 2, maxDelay);
        }
    }
    throw new Error("Max retries reached");
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


        const translatedParts: { original: string; translated: string; }[] = new Array(parts.length);
        const concurrencyLimit = currentSettings?.concurrencyLimit ?? 5;
        let activePromises = 0;
        let currentIndex = 0;

        const processPart = async (index: number) => {
            const part = parts[index];
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
                translatedParts[index] = { original: part, translated: cached.translatedHtml };
                return;
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

            translatedParts[index] = { original: restoredOriginal, translated: restoredTranslated };
        };

        const executeWithConcurrency = async () => {
            const promises: Promise<void>[] = [];
            for (let i = 0; i < parts.length; i++) {
                if (activePromises >= concurrencyLimit) {
                    await Promise.race(promises);
                }
                activePromises++;
                const p = processPart(i).finally(() => {
                    activePromises--;
                    promises.splice(promises.indexOf(p), 1);
                });
                promises.push(p);
            }
            await Promise.all(promises);
        };

        await executeWithConcurrency();

        const originalHtml = translatedParts.map((p) => p.original).join('');
        const translatedHtml = translatedParts.map((p) => p.translated).join('');

        return json({ originalHtml, translatedHtml, cachedParts: translatedParts.length });
    } catch (error: any) {
        console.error("AI Translation Error:", error);
        return json({ error: error.message || 'Translation failed' }, { status: 500 });
    }
}
