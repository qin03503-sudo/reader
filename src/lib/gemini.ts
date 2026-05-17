import { GoogleGenAI, Type, Schema } from "@google/genai";
import { settingsStore } from "./db";
import { AppSettings } from "../components/SettingsModal";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let currentKeyIndex = 0;

const TranslationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    original_html_with_spans: {
      type: Type.STRING,
      description: "The original HTML, but with EVERY logical sentence wrapped in `<span class=\"sync-hover\" data-sync-id=\"[unique-id]\">...</span>`."
    },
    translated_html_with_spans: {
      type: Type.STRING,
      description: "The translated HTML, preserving existing formatting, with corresponding sentences wrapped in `<span class=\"sync-hover\" data-sync-id=\"[same-unique-id]\">...</span>`."
    }
  },
  required: ["original_html_with_spans", "translated_html_with_spans"]
};

export async function translateHtmlBlock(html: string, targetLanguage: string, model: string = 'gemini-2.5-flash'): Promise<{ originalHtml: string, translatedHtml: string }> {
  const prompt = `You are an expert bilingual e-book translator. 
Target Language: ${targetLanguage}

Task:
1. Identify logical sentences within the provided HTML block.
2. Translate the text into ${targetLanguage}, preserving ALL original HTML tags (like <b>, <i>, <a>, <img>).
3. Wrap each matching logical sentence in BOTH the original and translated HTML with a span tag: <span class="sync-hover" data-sync-id="[sentence-index]">...</span>.
Use a simple numeric index 1, 2, 3... for the data-sync-id. The sync IDs must perfectly match between the original and translated versions so they can be highlighted together.

HTML Block:
${html}`;

  try {
    if (model.startsWith('custom:')) {
      // Use Custom OpenAI Endpoint
      const actualModel = model.replace('custom:', '');
      const settings = await settingsStore.getItem<AppSettings>('app_settings');
      if (!settings || !settings.openaiBaseUrl || !settings.openaiKey) {
        throw new Error('Custom OpenAI settings are missing. Please configure them in Settings.');
      }

      const url = settings.openaiBaseUrl.endsWith('/') 
        ? `${settings.openaiBaseUrl}chat/completions` 
        : `${settings.openaiBaseUrl}/chat/completions`;

      // Define OpenAI JSON Schema
      const jsonSchema = {
         type: "object",
         properties: {
           original_html_with_spans: { type: "string" },
           translated_html_with_spans: { type: "string" }
         },
         required: ["original_html_with_spans", "translated_html_with_spans"]
      };

      const keys = settings.openaiKeys && settings.openaiKeys.length > 0
        ? settings.openaiKeys.filter(k => k.trim() !== '')
        : [settings.openaiKey];

      if (keys.length === 0 || !keys[0]) {
        throw new Error('No API keys configured.');
      }

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < keys.length; attempt++) {
        const keyToUse = keys[(currentKeyIndex + attempt) % keys.length];

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${keyToUse}`
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
                  schema: jsonSchema
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

          // On success, update currentKeyIndex to the next key to distribute load
          currentKeyIndex = (currentKeyIndex + attempt + 1) % keys.length;

          return {
            originalHtml: parsed.original_html_with_spans,
            translatedHtml: parsed.translated_html_with_spans
          };
        } catch (e: any) {
          lastError = e;
          console.warn(`Attempt failed with key ${keyToUse.substring(0, 8)}...:`, e.message);
          // Loop continues to try the next key
        }
      }

      throw lastError || new Error("All API keys failed.");

    } else {
      // Standard Gemini
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: TranslationSchema,
          temperature: 0.1,
        }
      });

      if (!response.text) throw new Error("No response text");
      const data = JSON.parse(response.text);
      return {
        originalHtml: data.original_html_with_spans,
        translatedHtml: data.translated_html_with_spans
      };
    }
  } catch (error) {
    console.error("AI Translation Error:", error);
    return { originalHtml: html, translatedHtml: `<p class="text-red-500 text-sm p-2 border border-red-200 rounded mt-2">Error during translation.</p>` };
  }
}
