import re

with open('src/routes/api/translate/+server.ts', 'r') as f:
    content = f.read()

# fetchOpenAIFormat
old_fetch = """async function fetchOpenAIFormat(url: string, key: string, model: string, prompt: string) {
    let retries = 3;
    let delay = 2000;"""

new_fetch = """async function fetchOpenAIFormat(url: string, key: string, model: string, prompt: string, maxRetries: number = 3, baseDelay: number = 2000, maxDelay: number = 30000) {
    let retries = maxRetries;
    let delay = baseDelay;"""
content = content.replace(old_fetch, new_fetch)

# Inside fetchOpenAIFormat retry loop
old_fetch_catch = """        } catch (error: any) {
            retries--;
            if (retries === 0) {
                throw error;
            }
            console.warn(`Translation API request failed (${error.message}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }"""
new_fetch_catch = """        } catch (error: any) {
            if (retries === 0) {
                throw error;
            }
            console.warn(`Translation API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay = Math.min(delay * 2, maxDelay); // Exponential backoff with max
        }"""
content = content.replace(old_fetch_catch, new_fetch_catch)


# translateWithModel function signature and body calls
old_translate = """async function translateWithModel(model: string | undefined, currentSettings: any, prompt: string): Promise<TranslationResult> {"""
new_translate = """async function translateWithModel(model: string | undefined, currentSettings: any, prompt: string): Promise<TranslationResult> {
    const maxRetries = currentSettings?.maxRetries ?? 3;
    const baseDelay = currentSettings?.baseDelay ?? 2000;
    const maxDelay = currentSettings?.maxDelay ?? 30000;"""
content = content.replace(old_translate, new_translate)

# update all fetchOpenAIFormat calls to pass maxRetries, baseDelay, maxDelay
content = content.replace("fetchOpenAIFormat(url, keys[0], actualModel, prompt);", "fetchOpenAIFormat(url, keys[0], actualModel, prompt, maxRetries, baseDelay, maxDelay);")
content = content.replace("fetchOpenAIFormat('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt);", "fetchOpenAIFormat('https://openrouter.ai/api/v1/chat/completions', currentSettings.openrouterKey, actualModel, prompt, maxRetries, baseDelay, maxDelay);")


# Gemini retry
old_gemini_retry = """    let retries = 3;
    let delay = 2000;

    while (retries > 0) {"""
new_gemini_retry = """    let retries = maxRetries;
    let delay = baseDelay;

    while (retries > 0) {"""
content = content.replace(old_gemini_retry, new_gemini_retry)


old_gemini_catch = """        } catch (error: any) {
             retries--;
            if (retries === 0) {
                throw error;
            }
            console.warn(`Gemini API request failed (${error.message}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }"""

new_gemini_catch = """        } catch (error: any) {
            if (retries === 0) {
                throw error;
            }
            console.warn(`Gemini API request failed (${error.message}), retrying in ${delay}ms... (Retries left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay = Math.min(delay * 2, maxDelay);
        }"""
content = content.replace(old_gemini_catch, new_gemini_catch)


# Concurrency control in POST
old_post = """        const translatedParts: { original: string; translated: string; }[] = [];

        for (const part of parts) {
            const { sanitizedHtml, blocks } = protectNonTranslatableBlocks(part);"""

new_post = """        const translatedParts: { original: string; translated: string; }[] = new Array(parts.length);
        const concurrencyLimit = currentSettings?.concurrencyLimit ?? 5;
        let activePromises = 0;
        let currentIndex = 0;

        const processPart = async (index: number) => {
            const part = parts[index];
            const { sanitizedHtml, blocks } = protectNonTranslatableBlocks(part);
            const partHash = hashPart(sanitizedHtml, targetLanguage, partModel);

            const cacheKey = `hash:${partHash}::`;
            const cached = await db.query.translationCache.findFirst({
                where: and(
                    eq(translationCache.originalHtml, cacheKey),
                    eq(translationCache.targetLanguage, targetLanguage),
                    eq(translationCache.model, partModel)
                )
            });

            if (cached) {
                translatedParts[index] = { original: part, translated: cached.translatedHtml };
                return;
            }

            const prompt = buildPrompt(sanitizedHtml, targetLanguage, bookTitle, chapterTitle);
            const result = await translateWithModel(model, currentSettings, prompt);
            const restoredOriginal = restoreProtectedBlocks(result.original_html_with_spans, blocks);
            const restoredTranslated = restoreProtectedBlocks(result.translated_html_with_spans, blocks);

            await db.insert(translationCache).values({
                originalHtml: cacheKey,
                translatedHtml: restoredTranslated,
                targetLanguage,
                model: partModel
            });

            translatedParts[index] = { original: restoredOriginal, translated: restoredTranslated };
        };

        const executeWithConcurrency = async () => {
            const promises = [];
            for (let i = 0; i < parts.length; i++) {
                if (activePromises >= concurrencyLimit) {
                    await Promise.race(promises);
                }
                activePromises++;
                const p = processPart(i).finally(() => {
                    activePromises--;
                    promises.splice(promises.indexOf(p), 1);
                });
                promises.push(p);
            }
            await Promise.all(promises);
        };

        await executeWithConcurrency();"""

# Need to replace the whole for loop
import_match = re.search(r"        const translatedParts: \{ original: string; translated: string; \}\[\] = \[\];\n(.*?)        const originalHtml = translatedParts.map\(\(p\) => p\.original\)\.join\(''\);", content, re.DOTALL)
if import_match:
    content = content.replace(import_match.group(1), new_post + "\n\n")
    content = content.replace("const translatedParts: { original: string; translated: string; }[] = [];", "")


with open('src/routes/api/translate/+server.ts', 'w') as f:
    f.write(content)
