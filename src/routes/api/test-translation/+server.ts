import { json } from '@sveltejs/kit';
import { generateContentWithFallback } from '$lib/server/ai';

export async function POST({ request }) {
    try {
        const { provider, config } = await request.json();

        if (!provider || !config) {
            return json({ error: 'Missing provider or config' }, { status: 400 });
        }

        const prompt = "Say hello in French.";

        const systemPrompt = "You are an expert translator. Just say hello in the target language.";

        let model = "";
        let mockSettings: any = {
            maxRetries: 1,
            baseDelay: 1000,
            maxDelay: 2000
        };

        if (provider === 'gemini') {
            model = 'gemini-2.5-flash';
            // Gemini doesn't need baseUrl/key passed through settings in our current ai.ts implementation,
            // it reads from process.env. But we construct it anyway.
        } else if (provider === 'custom') {
            if (!config.baseUrl || !config.key || !config.model) {
                return json({ error: 'Missing Custom OpenAI configuration' }, { status: 400 });
            }
            model = `custom:${config.model}`;
            mockSettings.openaiBaseUrl = config.baseUrl;
            mockSettings.openaiKeys = [config.key];
            mockSettings.openaiModel = config.model;
        } else if (provider === 'litellm') {
            if (!config.baseUrl || !config.key || !config.model) {
                return json({ error: 'Missing LiteLLM configuration' }, { status: 400 });
            }
            model = `litellm:${config.model}`;
            mockSettings.litellmBaseUrl = config.baseUrl;
            mockSettings.litellmKeys = [config.key];
            mockSettings.litellmModel = config.model;
        } else if (provider === 'openrouter') {
             if (!config.key || !config.model) {
                return json({ error: 'Missing OpenRouter configuration' }, { status: 400 });
            }
            model = `openrouter:${config.model}`;
            mockSettings.openrouterKey = config.key;
            mockSettings.openrouterModel = config.model;
        } else if (provider === 'mistral') {
             if (!config.key || !config.model) {
                return json({ error: 'Missing Mistral configuration' }, { status: 400 });
            }
            model = `mistral:${config.model}`;
            mockSettings.mistralKey = config.key;
            mockSettings.mistralModel = config.model;
        } else {
             return json({ error: 'Unknown provider' }, { status: 400 });
        }

        const response = await generateContentWithFallback(
            model,
            mockSettings,
            prompt,
            systemPrompt,
            false // not json output
        );

        return json({ success: true, message: response });

    } catch (error: any) {
        console.error("Test Translation Error:", error);
        return json({ error: error.message || 'Test failed' }, { status: 500 });
    }
}
