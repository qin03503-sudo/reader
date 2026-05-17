import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { translationCache, settings } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

export async function POST({ request }) {
    const { html, targetLanguage, model } = await request.json();

    if (!html || !targetLanguage) {
        return json({ error: 'Missing html or targetLanguage' }, { status: 400 });
    }

    try {
        // Check cache first
        const cached = await db.query.translationCache.findFirst({
            where: and(
                eq(translationCache.originalHtml, html),
                eq(translationCache.targetLanguage, targetLanguage),
                eq(translationCache.model, model || 'gemini-2.5-flash')
            )
        });

        if (cached) {
            return json({
                originalHtml: cached.originalHtml,
                translatedHtml: cached.translatedHtml
            });
        }

        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });

        const prompt = `You are an expert bilingual e-book translator. 
Target Language: ${targetLanguage}

Task:
1. Identify logical sentences within the provided HTML block.
2. Translate the text into ${targetLanguage}, preserving ALL original HTML tags (like <b>, <i>, <a>, <img>).
3. Wrap each matching logical sentence in BOTH the original and translated HTML with a span tag: <span class="sync-hover" data-sync-id="[sentence-index]">...</span>.
Use a simple numeric index 1, 2, 3... for the data-sync-id. The sync IDs must perfectly match between the original and translated versions so they can be highlighted together.

HTML Block:
${html}

Respond ONLY with valid JSON containing keys \"original_html_with_spans\" and \"translated_html_with_spans\". Do not include any other text.`;

        let originalHtml = html;
        let translatedHtml = '';

        if (model?.startsWith('custom:')) {
            const actualModel = model.replace('custom:', '');
            
            if (!currentSettings || !currentSettings.openaiBaseUrl || (!currentSettings.openaiKey && (!currentSettings.openaiKeys || currentSettings.openaiKeys.length === 0))) {
                return json({ error: 'Custom OpenAI settings are missing.' }, { status: 400 });
            }

            const url = currentSettings.openaiBaseUrl.endsWith('/')
                ? `${currentSettings.openaiBaseUrl}chat/completions`
                : `${currentSettings.openaiBaseUrl}/chat/completions`;

            const keys = currentSettings.openaiKeys && currentSettings.openaiKeys.length > 0
                ? currentSettings.openaiKeys.filter(k => k && k.trim() !== '')
                : (currentSettings.openaiKey ? [currentSettings.openaiKey] : []);

            if (keys.length === 0 || !keys[0]) {
                 return json({ error: 'No API keys configured.' }, { status: 400 });
            }

            // Simplified standard fetch logic
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${keys[0]}`
                },
                body: JSON.stringify({
                    model: actualModel,
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
                throw new Error(`OpenAI API Error: ${errText}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            if (!content) throw new Error("No response text from custom model");

            const parsed = JSON.parse(content);
            originalHtml = parsed.original_html_with_spans;
            translatedHtml = parsed.translated_html_with_spans;


        } else if (model?.startsWith('openrouter:')) {
            const actualModel = model.replace('openrouter:', '');

            if (!currentSettings || !currentSettings.openRouterKey) {
                return json({ error: 'OpenRouter API key is missing.' }, { status: 400 });
            }

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSettings.openRouterKey}`
                },
                body: JSON.stringify({
                    model: actualModel,
                    messages: [
                        { role: "system", content: "You are an expert translator that precisely aligns HTML sentences." },
                        { role: "user", content: prompt }
                    ],
                    response_format: {
                        type: "json_object"
                    },
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API Error: ${errText}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            if (!content) throw new Error("No response text from OpenRouter model");

            try {
                const parsed = JSON.parse(content);
                originalHtml = parsed.original_html_with_spans || parsed.originalHtml;
                translatedHtml = parsed.translated_html_with_spans || parsed.translatedHtml;
            } catch (e) {
                // Sometime models wrap json with markdown
                const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[1]);
                    originalHtml = parsed.original_html_with_spans || parsed.originalHtml;
                    translatedHtml = parsed.translated_html_with_spans || parsed.translatedHtml;
                } else {
                    throw new Error("Failed to parse JSON from OpenRouter response");
                }
            }

        } else {
             // Standard Gemini
             // For testing purposes, we assume GEMINI_API_KEY is available in env or passed some other way.
             // If not available, we use a mock or standard error.
             const apiKey = process.env.GEMINI_API_KEY || '';
             if(!apiKey) {
                 return json({ error: 'GEMINI_API_KEY environment variable is not set.'}, { status: 500 });
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
            const data = JSON.parse(response.text);
            originalHtml = data.original_html_with_spans;
            translatedHtml = data.translated_html_with_spans;
        }

        // Cache the result
        await db.insert(translationCache).values({
            originalHtml,
            translatedHtml,
            targetLanguage,
            model: model || 'gemini-2.5-flash'
        });

        return json({ originalHtml, translatedHtml });

    } catch (error: any) {
        console.error("AI Translation Error:", error);
        return json({ error: error.message || 'Translation failed' }, { status: 500 });
    }
}
