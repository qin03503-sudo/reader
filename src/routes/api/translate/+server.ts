import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

const prisma = new PrismaClient();

export async function POST({ request }) {
    const { html, targetLanguage, model } = await request.json();

    if (!html || !targetLanguage) {
        return json({ error: 'Missing html or targetLanguage' }, { status: 400 });
    }

    try {
        // Check cache first
        const cached = await prisma.translationCache.findFirst({
            where: {
                originalHtml: html,
                targetLanguage: targetLanguage,
                model: model || 'gemini-2.5-flash'
            }
        });

        if (cached) {
            return json({
                originalHtml: cached.originalHtml,
                translatedHtml: cached.translatedHtml
            });
        }

        const settings = await prisma.settings.findUnique({ where: { id: 'default' } });

        const prompt = `You are an expert bilingual e-book translator. 
Target Language: ${targetLanguage}

Task:
1. Identify logical sentences within the provided HTML block.
2. Translate the text into ${targetLanguage}, preserving ALL original HTML tags (like <b>, <i>, <a>, <img>).
3. Wrap each matching logical sentence in BOTH the original and translated HTML with a span tag: <span class="sync-hover" data-sync-id="[sentence-index]">...</span>.
Use a simple numeric index 1, 2, 3... for the data-sync-id. The sync IDs must perfectly match between the original and translated versions so they can be highlighted together.

HTML Block:
${html}`;

        let originalHtml = html;
        let translatedHtml = '';

        if (model?.startsWith('custom:')) {
            const actualModel = model.replace('custom:', '');
            
            if (!settings || !settings.openaiBaseUrl || !settings.openaiKey) {
                return json({ error: 'Custom OpenAI settings are missing.' }, { status: 400 });
            }

            const url = settings.openaiBaseUrl.endsWith('/') 
                ? `${settings.openaiBaseUrl}chat/completions` 
                : `${settings.openaiBaseUrl}/chat/completions`;

            const keys = settings.openaiKeys && settings.openaiKeys.length > 0
                ? settings.openaiKeys.filter(k => k.trim() !== '')
                : [settings.openaiKey];

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
        await prisma.translationCache.create({
            data: {
                originalHtml,
                translatedHtml,
                targetLanguage,
                model: model || 'gemini-2.5-flash'
            }
        });

        return json({ originalHtml, translatedHtml });

    } catch (error: any) {
        console.error("AI Translation Error:", error);
        return json({ error: error.message || 'Translation failed' }, { status: 500 });
    }
}
