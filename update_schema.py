import re

with open('src/lib/server/schema.ts', 'r') as f:
    content = f.read()

import_match = re.search(r"import { pgTable, text, timestamp, uuid(.*?)} from 'drizzle-orm/pg-core';", content)
if import_match and 'integer' not in import_match.group(1):
    content = content.replace(
        "import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';",
        "import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';"
    )

new_fields = """  defaultModel: text('default_model').default('gemini-2.5-flash'),
  maxRetries: integer('max_retries').default(3).notNull(),
  baseDelay: integer('base_delay').default(2000).notNull(),
  maxDelay: integer('max_delay').default(30000).notNull(),
  concurrencyLimit: integer('concurrency_limit').default(5).notNull(),"""

content = content.replace("  defaultModel: text('default_model').default('gemini-2.5-flash'),", new_fields)

with open('src/lib/server/schema.ts', 'w') as f:
    f.write(content)
