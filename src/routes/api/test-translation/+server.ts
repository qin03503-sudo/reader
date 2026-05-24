import { json } from '@sveltejs/kit';
import { GoogleGenAI } from '@google/genai';

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
                { role: "system", content: "You are an expert translator. Just say hello in the target language." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response text from model");

    return content;
}

export async function POST({ request }) {
    try {
        const { provider, config } = await request.json();

        if (!provider || !config) {
            return json({ error: 'Missing provider or config' }, { status: 400 });
        }

        const prompt = "Say hello in French.";

        if (provider === 'gemini') {
            const apiKey = process.env.GEMINI_API_KEY || '';
            if(!apiKey) {
                return json({ error: 'GEMINI_API_KEY environment variable is not set.'}, { status: 500 });
            }

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            if (!response.text) throw new Error("No response text");
            return json({ success: true, message: response.text });
        } else if (provider === 'custom') {
            if (!config.baseUrl || !config.key || !config.model) {
                return json({ error: 'Missing Custom OpenAI configuration' }, { status: 400 });
            }
            const url = config.baseUrl.endsWith('/') ? `${config.baseUrl}chat/completions` : `${config.baseUrl}/chat/completions`;
            const response = await fetchOpenAIFormat(url, config.key, config.model, prompt);
            return json({ success: true, message: response });
        } else if (provider === 'litellm') {
            if (!config.baseUrl || !config.key || !config.model) {
                return json({ error: 'Missing LiteLLM configuration' }, { status: 400 });
            }
            const url = config.baseUrl.endsWith('/') ? `${config.baseUrl}chat/completions` : `${config.baseUrl}/chat/completions`;
            const response = await fetchOpenAIFormat(url, config.key, config.model, prompt);
            return json({ success: true, message: response });
        } else if (provider === 'openrouter') {
             if (!config.key || !config.model) {
                return json({ error: 'Missing OpenRouter configuration' }, { status: 400 });
            }
            const url = 'https://openrouter.ai/api/v1/chat/completions';
            const response = await fetchOpenAIFormat(url, config.key, config.model, prompt);
            return json({ success: true, message: response });
        } else if (provider === 'mistral') {
             if (!config.key || !config.model) {
                return json({ error: 'Missing Mistral configuration' }, { status: 400 });
            }
            const baseUrl = config.baseUrl || 'https://api.mistral.ai/v1';
            const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
            const response = await fetchOpenAIFormat(url, config.key, config.model, prompt);
            return json({ success: true, message: response });
        } else {
             return json({ error: 'Unknown provider' }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Test Translation Error:", error);
        return json({ error: error.message || 'Test failed' }, { status: 500 });
    }
}
