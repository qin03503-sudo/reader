import { GoogleGenAI } from '@google/genai';

export async function fetchOpenAIFormat(
    url: string,
    key: string,
    model: string,
    prompt: string,
    systemPrompt: string,
    responseFormat?: any
) {
    let retries = 3;
    let delay = 2000;

    while (retries > 0) {
        try {
            const body: any = {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1
            };

            if (responseFormat) {
                body.response_format = responseFormat;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(body)
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
                throw new Error(`Unexpected AI API response shape: ${JSON.stringify(data).slice(0, 600)}`);
            }

            if (responseFormat) {
                try {
                    return JSON.parse(content);
                } catch {
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) throw new Error('Model response was not valid JSON.');
                    return JSON.parse(jsonMatch[0]);
                }
            }

            return content;
        } catch (error: any) {
            retries--;
            if (retries === 0) {
                throw error;
            }
            console.warn(`AI API request failed (${error.message}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
    throw new Error("Max retries reached");
}

export async function generateContentWithFallback(
    model: string | undefined,
    currentSettings: any,
    prompt: string,
    systemPrompt: string,
    responseFormat?: any
) {
    if (model === 'custom' || model?.startsWith('custom:')) {
        if (!currentSettings || !currentSettings.openaiBaseUrl || (!currentSettings.openaiKey && (!currentSettings.openaiKeys || currentSettings.openaiKeys.length === 0))) {
            throw new Error('Custom OpenAI settings are missing.');
        }
        const url = currentSettings.openaiBaseUrl.endsWith('/') ? `${currentSettings.openaiBaseUrl}chat/completions` : `${currentSettings.openaiBaseUrl}/chat/completions`;
        const keys = currentSettings.openaiKeys && currentSettings.openaiKeys.length > 0 ? currentSettings.openaiKeys.filter((k: string) => k && k.trim() !== '') : (currentSettings.openaiKey ? [currentSettings.openaiKey] : []);
        if (keys.length === 0 || !keys[0]) throw new Error('No API keys configured.');
        const actualModel = (model === 'custom' ? '' : model.replace('custom:', '')) || currentSettings.openaiModel || 'deepseek-chat';

        return fetchOpenAIFormat(url, keys[0], actualModel, prompt, systemPrompt, responseFormat);
    }

    if (model === 'litellm' || model?.startsWith('litellm:')) {
        if (!currentSettings || !currentSettings.litellmBaseUrl || (!currentSettings.litellmKeys || currentSettings.litellmKeys.length === 0)) {
            throw new Error('LiteLLM settings are missing.');
        }
        const url = currentSettings.litellmBaseUrl.endsWith('/') ? `${currentSettings.litellmBaseUrl}chat/completions` : `${currentSettings.litellmBaseUrl}/chat/completions`;
        const keys = currentSettings.litellmKeys.filter((k: string) => k && k.trim() !== '');
        if (keys.length === 0 || !keys[0]) throw new Error('No LiteLLM API keys configured.');
        const actualModel = (model === 'litellm' ? '' : model.replace('litellm:', '')) || currentSettings.litellmModel || 'deepseek-chat';

        return fetchOpenAIFormat(url, keys[0], actualModel, prompt, systemPrompt, responseFormat);
    }

    if (model === 'openrouter' || model?.startsWith('openrouter:')) {
        if (!currentSettings || !currentSettings.openrouterKey) {
            throw new Error('OpenRouter settings are missing.');
        }
        const actualModel = (model === 'openrouter' ? '' : model.replace('openrouter:', '')) || currentSettings.openrouterModel || 'deepseek/deepseek-chat';
        return fetchOpenAIFormat('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt, systemPrompt, responseFormat);
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set.');
    }

    const ai = new GoogleGenAI({ apiKey });

    let retries = 3;
    let delay = 2000;

    while (retries > 0) {
        try {
            const config: any = {
                temperature: 0.1,
            };

            if (systemPrompt) {
                config.systemInstruction = systemPrompt;
            }

            if (responseFormat) {
                config.responseMimeType = "application/json";
                if (responseFormat.type === 'json_schema' && responseFormat.json_schema?.schema) {
                     // Translate basic json_schema to gemini schema
                     const schema = responseFormat.json_schema.schema;
                     config.responseSchema = {
                         type: "OBJECT",
                         properties: {},
                         required: schema.required || []
                     };
                     if (schema.properties) {
                         for (const [key, value] of Object.entries<any>(schema.properties)) {
                             config.responseSchema.properties[key] = { type: value.type === 'string' ? 'STRING' : value.type.toUpperCase() };
                         }
                     }
                }
            }

            const response = await ai.models.generateContent({
                model: model || 'gemini-2.5-flash',
                contents: prompt,
                config
            });

            if (!response.text) throw new Error("No response text");

            if (responseFormat) {
                try {
                    return JSON.parse(response.text);
                } catch {
                    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) throw new Error('Model response was not valid JSON.');
                    return JSON.parse(jsonMatch[0]);
                }
            }

            return response.text;
        } catch (error: any) {
            retries--;
            if (retries === 0) {
                throw error;
            }
            console.warn(`Gemini API request failed (${error.message}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
    throw new Error("Max retries reached");
}
