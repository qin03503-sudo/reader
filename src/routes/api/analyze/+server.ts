import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

async function fetchOpenAIApi(url: string, key: string, model: string, prompt: string, maxRetries: number = 3, baseDelay: number = 2000, maxDelay: number = 30000) {
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
                { role: "system", content: "You are an expert language teacher and linguist." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
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
        } catch (error: any) {
            if (retries === 1) {
                throw error;
            }
            console.warn(`Analyze API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries - 1})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay = Math.min(delay * 2, maxDelay);
        }
    }
}

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

        let analysis;

        if (model === 'custom' || model?.startsWith('custom:')) {
            const actualModel = (model === 'custom' ? '' : model.replace('custom:', '')) || currentSettings?.openaiModel || 'deepseek-chat';
            if (!currentSettings?.openaiBaseUrl || !currentSettings?.openaiKeys?.length) {
                 return json({ error: 'Custom OpenAI settings missing' }, { status: 400 });
            }
            const url = currentSettings.openaiBaseUrl.endsWith('/') ? `${currentSettings.openaiBaseUrl}chat/completions` : `${currentSettings.openaiBaseUrl}/chat/completions`;
            analysis = await fetchOpenAIApi(url, currentSettings.openaiKeys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);

        } else if (model === 'litellm' || model?.startsWith('litellm:')) {
            const actualModel = (model === 'litellm' ? '' : model.replace('litellm:', '')) || currentSettings?.litellmModel || 'deepseek-chat';
            if (!currentSettings?.litellmBaseUrl || !currentSettings?.litellmKeys?.length) {
                 return json({ error: 'LiteLLM settings missing' }, { status: 400 });
            }
            const url = currentSettings.litellmBaseUrl.endsWith('/') ? `${currentSettings.litellmBaseUrl}chat/completions` : `${currentSettings.litellmBaseUrl}/chat/completions`;
            analysis = await fetchOpenAIApi(url, currentSettings.litellmKeys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);

        } else if (model === 'openrouter' || model?.startsWith('openrouter:')) {
            const actualModel = (model === 'openrouter' ? '' : model.replace('openrouter:', '')) || currentSettings?.openrouterModel || 'deepseek/deepseek-chat';
            if (!currentSettings?.openrouterKey) {
                 return json({ error: 'OpenRouter settings missing' }, { status: 400 });
            }
            analysis = await fetchOpenAIApi('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt, maxRetries, baseDelay, maxDelay);

        } else {
            // Standard Gemini
            const apiKey = process.env.GEMINI_API_KEY || '';
            if(!apiKey) return json({ error: 'GEMINI_API_KEY environment variable is not set.'}, { status: 500 });

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
                            temperature: 0.1,
                        }
                    });

                    if (!response.text) throw new Error("No response text");
                    analysis = JSON.parse(response.text);
                    break;
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
        }

        return json(analysis);

    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        return json({ error: error.message || 'Analysis failed' }, { status: 500 });
    }
}
