import re

with open('src/routes/api/analyze/+server.ts', 'r') as f:
    content = f.read()

# Update fetchOpenAIApi definition
old_fetch = "async function fetchOpenAIApi(url: string, key: string, model: string, prompt: string) {"
new_fetch = "async function fetchOpenAIApi(url: string, key: string, model: string, prompt: string, maxRetries: number = 3, baseDelay: number = 2000, maxDelay: number = 30000) {\n    let retries = maxRetries;\n    let delay = baseDelay;\n    while (retries > 0) {\n        try {"
content = content.replace(old_fetch, new_fetch)

# Update fetchOpenAIApi catch
old_fetch_catch = """    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("No response text from model");

    return JSON.parse(content);
}"""

new_fetch_catch = """    if (!response.ok) {
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
}"""
content = content.replace(old_fetch_catch, new_fetch_catch)


# Fetch maxRetries, etc in POST
old_post = "        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });"
new_post = """        const currentSettings = await db.query.settings.findFirst({ where: eq(settings.id, 'default') });
        const maxRetries = currentSettings?.maxRetries ?? 3;
        const baseDelay = currentSettings?.baseDelay ?? 2000;
        const maxDelay = currentSettings?.maxDelay ?? 30000;"""
content = content.replace(old_post, new_post)


# Update fetchOpenAIApi calls in POST
content = content.replace("fetchOpenAIApi(url, currentSettings.openaiKeys[0], actualModel, prompt);", "fetchOpenAIApi(url, currentSettings.openaiKeys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);")
content = content.replace("fetchOpenAIApi(url, currentSettings.litellmKeys[0], actualModel, prompt);", "fetchOpenAIApi(url, currentSettings.litellmKeys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);")
content = content.replace("fetchOpenAIApi('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt);", "fetchOpenAIApi('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt, maxRetries, baseDelay, maxDelay);")


# Update standard Gemini calls with retry loop
old_gemini = """            // Standard Gemini
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
            analysis = JSON.parse(response.text);"""

new_gemini = """            // Standard Gemini
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
            }"""

content = content.replace(old_gemini, new_gemini)

with open('src/routes/api/analyze/+server.ts', 'w') as f:
    f.write(content)
