import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { translationCache, settings } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { generateContentWithFallback } from '$lib/server/ai';


type TranslationResult = {
    original_html_with_spans: string;
    translated_html_with_spans: string;
};

type ProtectedBlock = {
    token: string;
    html: string;
};

function splitHtmlIntoTranslatableParts(html: string, maxPartLength = 2500): string[] {
    const blockRegex = /(<(?:p|div|section|article|blockquote|h[1-6]|li|pre|code|table|figure)[^>]*>[\s\S]*?<\/(?:p|div|section|article|blockquote|h[1-6]|li|pre|code|table|figure)>)/gi;
    const blocks = html.split(blockRegex).filter(t => t.trim() !== '');

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
            const prefixIds = (html: string, prefix: string) => html.replace(/data-sync-id="([^"]+)"/g, `data-sync-id="${prefix}$1"`);
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
                const cachedOriginal = cached.originalHtmlWithSpans || part;
                translatedParts[index] = {
                    original: prefixIds(cachedOriginal, `${index}_`),
                    translated: prefixIds(cached.translatedHtml, `${index}_`)
                };
                return;
            }

            const prompt = buildPrompt(sanitizedHtml, targetLanguage, bookTitle, chapterTitle);
            const systemPrompt = "You are an expert translator that precisely aligns HTML sentences.";
            const jsonSchemaProperties = {
                original_html_with_spans: { type: "string" },
                translated_html_with_spans: { type: "string" }
            };
            const jsonSchemaRequired = ["original_html_with_spans", "translated_html_with_spans"];

            const result = await generateContentWithFallback(
                model,
                currentSettings,
                prompt,
                systemPrompt,
                true,
                "translation_result",
                jsonSchemaProperties,
                jsonSchemaRequired
            );
            const restoredOriginal = restoreProtectedBlocks(result.original_html_with_spans, blocks);
            const restoredTranslated = restoreProtectedBlocks(result.translated_html_with_spans, blocks);

            await db.insert(translationCache).values({
                originalHtml: cacheKey,
                originalHtmlWithSpans: restoredOriginal,
                translatedHtml: restoredTranslated,
                targetLanguage,
                model: partModel
            });

            translatedParts[index] = {
                original: prefixIds(restoredOriginal, `${index}_`),
                translated: prefixIds(restoredTranslated, `${index}_`)
            };
        };

        const executeWithConcurrency = async () => {
            for (let i = 0; i < parts.length; i += concurrencyLimit) {
                const chunk = parts.slice(i, i + concurrencyLimit);
                const chunkPromises = chunk.map((_, indexInChunk) => processPart(i + indexInChunk));
                await Promise.all(chunkPromises);
            }
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
