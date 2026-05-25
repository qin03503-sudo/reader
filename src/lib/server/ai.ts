import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

export async function generateContentWithFallback(
    model: string | undefined,
    currentSettings: any,
    prompt: string,
    systemPrompt: string,
    isJsonOutput: boolean,
    jsonSchemaName?: string,
    jsonSchemaProperties?: any,
    jsonSchemaRequired?: string[]
) {
    let proxyAgent: any = undefined;
    if (currentSettings?.proxyUrl) {
        if (currentSettings.proxyUrl.startsWith('socks')) {
            proxyAgent = new SocksProxyAgent(currentSettings.proxyUrl);
        } else if (currentSettings.proxyUrl.startsWith('http')) {
            proxyAgent = new HttpsProxyAgent(currentSettings.proxyUrl);
        }
    }

    const maxRetries = currentSettings?.maxRetries ?? 3;
    const baseDelay = currentSettings?.baseDelay ?? 2000;
    const maxDelay = currentSettings?.maxDelay ?? 30000;

    // Build common OpenAI payload
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
    ];

    let response_format: any = undefined;
    if (isJsonOutput) {
        if (jsonSchemaName && jsonSchemaProperties && jsonSchemaRequired) {
            response_format = {
                type: "json_schema",
                json_schema: {
                    name: jsonSchemaName,
                    strict: false,
                    schema: {
                        type: "object",
                        properties: jsonSchemaProperties,
                        required: jsonSchemaRequired
                    }
                }
            };
        } else {
             response_format = { type: "json_object" };
        }
    }

    const openaiStylePayload = {
        model: model,
        messages: messages,
        temperature: 0.1,
        ...(response_format ? { response_format } : {})
    };

    const fetchOpenAIFormat = async (url: string, key: string, payload: any) => {
        let retries = maxRetries;
        let delay = baseDelay;

        while (retries > 0) {
            try {
                                const fetchOptions: any = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify(payload)
                };
                if (proxyAgent) {
                    fetchOptions.agent = proxyAgent;
                }
                const response = await (proxyAgent ? nodeFetch(url, fetchOptions) as any : fetch(url, fetchOptions));

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

                if (isJsonOutput) {
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
                if (retries === 1) { // this was 0 in translate but 1 in analyze. 1 makes sense to not wait again before failing
                    throw error;
                }
                console.warn(`AI API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries - 1})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries--;
                delay = Math.min(delay * 2, maxDelay);
            }
        }
        throw new Error("Max retries reached");
    };

    if (model === 'custom' || model?.startsWith('custom:')) {
        if (!currentSettings || !currentSettings.openaiBaseUrl || (!currentSettings.openaiKey && (!currentSettings.openaiKeys || currentSettings.openaiKeys.length === 0))) {
            throw new Error('Custom OpenAI settings are missing.');
        }
        const url = currentSettings.openaiBaseUrl.endsWith('/') ? `${currentSettings.openaiBaseUrl}chat/completions` : `${currentSettings.openaiBaseUrl}/chat/completions`;
        const keys = currentSettings.openaiKeys && currentSettings.openaiKeys.length > 0 ? currentSettings.openaiKeys.filter((k: string) => k && k.trim() !== '') : (currentSettings.openaiKey ? [currentSettings.openaiKey] : []);
        if (keys.length === 0 || !keys[0]) throw new Error('No API keys configured.');
        const actualModel = (model === 'custom' ? '' : model.replace('custom:', '')) || currentSettings.openaiModel || 'deepseek-chat';

        openaiStylePayload.model = actualModel;
        return fetchOpenAIFormat(url, keys[0], openaiStylePayload);
    }

    if (model === 'litellm' || model?.startsWith('litellm:')) {
        if (!currentSettings || !currentSettings.litellmBaseUrl || (!currentSettings.litellmKeys || currentSettings.litellmKeys.length === 0)) {
            throw new Error('LiteLLM settings are missing.');
        }
        const url = currentSettings.litellmBaseUrl.endsWith('/') ? `${currentSettings.litellmBaseUrl}chat/completions` : `${currentSettings.litellmBaseUrl}/chat/completions`;
        const keys = currentSettings.litellmKeys.filter((k: string) => k && k.trim() !== '');
        if (keys.length === 0 || !keys[0]) throw new Error('No LiteLLM API keys configured.');
        const actualModel = (model === 'litellm' ? '' : model.replace('litellm:', '')) || currentSettings.litellmModel || 'deepseek-chat';

        openaiStylePayload.model = actualModel;
        return fetchOpenAIFormat(url, keys[0], openaiStylePayload);
    }

    if (model === 'openrouter' || model?.startsWith('openrouter:')) {
        const keys = currentSettings?.openrouterKeys && currentSettings.openrouterKeys.length > 0 ? currentSettings.openrouterKeys.filter((k: string) => k && k.trim() !== '') : (currentSettings?.openrouterKey ? [currentSettings.openrouterKey] : []);
        if (keys.length === 0 || !keys[0]) throw new Error('OpenRouter settings are missing.');
        const key = keys[Math.floor(Math.random() * keys.length)];
        const actualModel = (model === 'openrouter' ? '' : model.replace('openrouter:', '')) || currentSettings.openrouterModel || 'deepseek/deepseek-chat';
        openaiStylePayload.model = actualModel;
        return fetchOpenAIFormat('https://openrouter.ai/api/v1/chat/completions', key, openaiStylePayload);
    }

    if (model === 'mistral' || model?.startsWith('mistral:')) {
        const keys = currentSettings?.mistralKeys && currentSettings.mistralKeys.length > 0 ? currentSettings.mistralKeys.filter((k: string) => k && k.trim() !== '') : (currentSettings?.mistralKey ? [currentSettings.mistralKey] : []);
        if (keys.length === 0 || !keys[0]) throw new Error('Mistral settings are missing.');
        const key = keys[Math.floor(Math.random() * keys.length)];
        const actualModel = (model === 'mistral' ? '' : model.replace('mistral:', '')) || currentSettings.mistralModel || 'mistral-large-latest';
        openaiStylePayload.model = actualModel;
        return fetchOpenAIFormat('https://api.mistral.ai/v1/chat/completions', key, openaiStylePayload);
    }

    // Default to Gemini
    const keysRaw = process.env.GEMINI_API_KEY || '';
    const geminiKeys = keysRaw.split(',').map((k: string) => k.trim()).filter((k: string) => k !== '');
    if(geminiKeys.length === 0) {
        throw new Error('GEMINI_API_KEY environment variable is not set. Set it or provide a comma-separated list of keys.');
    }
    const apiKey = geminiKeys[Math.floor(Math.random() * geminiKeys.length)];


    const aiConfig: any = { apiKey };
    if (proxyAgent) {
        aiConfig.httpOptions = {
            fetch: async (url: string | URL | Request, init?: RequestInit) => {
                // @ts-ignore
                return nodeFetch(url, { ...init, agent: proxyAgent });
            }
        };
    }
    const ai = new GoogleGenAI(aiConfig);

    let retries = maxRetries;
    let delay = baseDelay;

    while (retries > 0) {
        try {
            const config: any = {
                 temperature: 0.1,
                 systemInstruction: systemPrompt
            };

            if (isJsonOutput) {
                config.responseMimeType = "application/json";
                if (jsonSchemaName && jsonSchemaProperties && jsonSchemaRequired) {
                     config.responseSchema = {
                        type: "OBJECT",
                        properties: Object.fromEntries(Object.entries(jsonSchemaProperties).map(([k, v]: [string, any]) => {
                             return [k, { type: v.type === 'string' ? 'STRING' : v.type.toUpperCase() }];
                        })),
                        required: jsonSchemaRequired
                    };
                }
            }

            const response = await ai.models.generateContent({
                model: model || 'gemini-2.5-flash',
                contents: prompt,
                config: config
            });

            if (!response.text) throw new Error("No response text");

            if (isJsonOutput) {
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
