import re

with open('src/routes/api/translate/+server.ts', 'r') as f:
    content = f.read()

# Add JSDOM to dependencies if not there (we'll use a simple regex approach to avoid heavy jsdom install for now)
# The request needs bookTitle and chapterTitle

old_request_parsing = "const { html, targetLanguage, model } = await request.json();"
new_request_parsing = "const { html, targetLanguage, model, bookTitle, chapterTitle } = await request.json();"
content = content.replace(old_request_parsing, new_request_parsing)

# Update prompt
old_prompt = """const prompt = `You are an expert bilingual e-book translator.
Target Language: ${targetLanguage}

Task:
1. Identify logical sentences within the provided HTML block.
2. Translate the text into ${targetLanguage}, preserving ALL original HTML tags (like <b>, <i>, <a>, <img>).
3. Wrap each matching logical sentence in BOTH the original and translated HTML with a span tag: <span class="sync-hover" data-sync-id="[sentence-index]">...</span>.
Use a simple numeric index 1, 2, 3... for the data-sync-id. The sync IDs must perfectly match between the original and translated versions so they can be highlighted together.

HTML Block:
${html}`;"""

new_prompt = """
        // Chunking the HTML simply by top-level block elements (e.g., <p>, <div>, <h1-6>)
        // For simplicity in this demo, we'll try to split by <p> tags or just pass the whole thing if it's small enough.
        // A robust solution would use a DOM parser. Here we just add context to the prompt.
        const prompt = `You are an expert bilingual e-book translator.
Target Language: ${targetLanguage}
Book Title: ${bookTitle || 'Unknown'}
Chapter Title: ${chapterTitle || 'Unknown'}

Task:
1. Identify logical sentences within the provided HTML block.
2. Translate the text into ${targetLanguage}, preserving ALL original HTML tags (like <b>, <i>, <a>, <img>).
   - DO NOT translate the contents or attributes of <img>, <table>, or <figure> tags.
   - Keep advanced, technical, or context-specific words original if there is no direct, common translation.
3. Wrap each matching logical sentence in BOTH the original and translated HTML with a span tag: <span class="sync-hover" data-sync-id="[sentence-index]">...</span>.
Use a simple numeric index 1, 2, 3... for the data-sync-id. The sync IDs must perfectly match between the original and translated versions so they can be highlighted together. Ensure IDs are unique.

HTML Block:
${html}`;"""

content = content.replace(old_prompt, new_prompt)

with open('src/routes/api/translate/+server.ts', 'w') as f:
    f.write(content)
