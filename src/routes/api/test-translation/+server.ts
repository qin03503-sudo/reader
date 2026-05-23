import { json } from '@sveltejs/kit';
import { fetchOpenAIFormat, generateContentWithFallback } from '$lib/server/ai';

export async function POST({ request }) {
    try {
        const { provider, config } = await request.json();

        if (!provider || !config) {
            return json({ error: 'Missing provider or config' }, { status: 400 });
        }

        const prompt = "Say hello in French.";

        const systemPrompt = "You are an expert translator. Just say hello in the target language.";
        if (provider === 'gemini') {
            const response = await generateContentWithFallback('gemini-2.5-flash', {}, prompt, systemPrompt);
            return json({ success: true, message: response });
        } else if (provider === 'custom') {
            if (!config.baseUrl || !config.key || !config.model) {
                return json({ error: 'Missing Custom OpenAI configuration' }, { status: 400 });
            }
            const url = config.baseUrl.endsWith('/') ? `${config.baseUrl}chat/completions` : `${config.baseUrl}/chat/completions`;
            const response = await fetchOpenAIFormat(url, config.key, config.model, prompt, systemPrompt);
            return json({ success: true, message: response });
        } else if (provider === 'litellm') {
            if (!config.baseUrl || !config.key || !config.model) {
                return json({ error: 'Missing LiteLLM configuration' }, { status: 400 });
            }
            const url = config.baseUrl.endsWith('/') ? `${config.baseUrl}chat/completions` : `${config.baseUrl}/chat/completions`;
            const response = await fetchOpenAIFormat(url, config.key, config.model, prompt, systemPrompt);
            return json({ success: true, message: response });
        } else if (provider === 'openrouter') {
             if (!config.key || !config.model) {
                return json({ error: 'Missing OpenRouter configuration' }, { status: 400 });
            }
            const url = 'https://openrouter.ai/api/v1/chat/completions';
            const response = await fetchOpenAIFormat(url, config.key, config.model, prompt, systemPrompt);
            return json({ success: true, message: response });
        } else {
             return json({ error: 'Unknown provider' }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Test Translation Error:", error);
        return json({ error: error.message || 'Test failed' }, { status: 500 });
    }
}
