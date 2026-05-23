import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

async function fetchOpenAIApi(url: string, key: string, model: string, prompt: string) {
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
}

export async function POST({ request }) {
    const { sentence, targetLanguage, model, context } = await request.json();

    if (!sentence || !targetLanguage) {
        return json({ error: 'Missing sentence or targetLanguage' }, { status: 400 });
    }

    try {
        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });

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
            analysis = await fetchOpenAIApi(url, currentSettings.openaiKeys[0], actualModel, prompt);

        } else if (model === 'litellm' || model?.startsWith('litellm:')) {
            const actualModel = (model === 'litellm' ? '' : model.replace('litellm:', '')) || currentSettings?.litellmModel || 'deepseek-chat';
            if (!currentSettings?.litellmBaseUrl || !currentSettings?.litellmKeys?.length) {
                 return json({ error: 'LiteLLM settings missing' }, { status: 400 });
            }
            const url = currentSettings.litellmBaseUrl.endsWith('/') ? `${currentSettings.litellmBaseUrl}chat/completions` : `${currentSettings.litellmBaseUrl}/chat/completions`;
            analysis = await fetchOpenAIApi(url, currentSettings.litellmKeys[0], actualModel, prompt);

        } else if (model === 'openrouter' || model?.startsWith('openrouter:')) {
            const actualModel = (model === 'openrouter' ? '' : model.replace('openrouter:', '')) || currentSettings?.openrouterModel || 'deepseek/deepseek-chat';
            if (!currentSettings?.openrouterKey) {
                 return json({ error: 'OpenRouter settings missing' }, { status: 400 });
            }
            analysis = await fetchOpenAIApi('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt);

        } else {
            // Standard Gemini
            const apiKey = process.env.GEMINI_API_KEY || '';
            if(!apiKey) return json({ error: 'GEMINI_API_KEY environment variable is not set.'}, { status: 500 });

            const ai = new GoogleGenAI({ apiKey });
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
        }

        return json(analysis);

    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        return json({ error: error.message || 'Analysis failed' }, { status: 500 });
    }
}
