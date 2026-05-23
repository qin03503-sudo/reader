import re

with open('src/routes/api/settings/+server.ts', 'r') as f:
    content = f.read()

get_insert = """                openrouterModel: 'deepseek/deepseek-chat',
                defaultModel: 'gemini-2.5-flash',
                maxRetries: 3,
                baseDelay: 2000,
                maxDelay: 30000,
                concurrencyLimit: 5"""
content = content.replace("                openrouterModel: 'deepseek/deepseek-chat',\n                defaultModel: 'gemini-2.5-flash'", get_insert)

post_insert_1 = """            openrouterModel: body.openrouterModel || 'deepseek/deepseek-chat',
            defaultModel: body.defaultModel || 'gemini-2.5-flash',
            maxRetries: body.maxRetries ?? 3,
            baseDelay: body.baseDelay ?? 2000,
            maxDelay: body.maxDelay ?? 30000,
            concurrencyLimit: body.concurrencyLimit ?? 5"""
content = content.replace("            openrouterModel: body.openrouterModel || 'deepseek/deepseek-chat',\n            defaultModel: body.defaultModel || 'gemini-2.5-flash'", post_insert_1)

post_insert_2 = """                openrouterModel: body.openrouterModel,
                defaultModel: body.defaultModel,
                maxRetries: body.maxRetries,
                baseDelay: body.baseDelay,
                maxDelay: body.maxDelay,
                concurrencyLimit: body.concurrencyLimit"""
content = content.replace("                openrouterModel: body.openrouterModel,\n                defaultModel: body.defaultModel", post_insert_2)

with open('src/routes/api/settings/+server.ts', 'w') as f:
    f.write(content)
