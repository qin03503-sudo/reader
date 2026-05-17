# Migrating from Prisma to Drizzle ORM

This guide outlines the steps taken to completely migrate our SvelteKit application from Prisma to Drizzle ORM with PostgreSQL.

## 1. Cleanup Prisma

To safely remove Prisma from the project, run the following commands:

```bash
# Uninstall Prisma dependencies
npm uninstall @prisma/client prisma

# Remove Prisma schema and directory
rm -rf prisma/
```

Additionally, update your `Dockerfile` to remove the `# Generate Prisma client` build step, as it's no longer necessary. Keep `.env.example` as it contains `DATABASE_URL`, which is still used by Drizzle.

## 2. Installation

Install Drizzle ORM, the Postgres driver, and Drizzle Kit as devDependencies to prepare for a bundled build:

```bash
npm install -D drizzle-orm postgres drizzle-kit dotenv
```

## 3. Schema Translation

Here is an example of converting a basic Prisma `User` model into a Drizzle schema (`src/lib/server/schema.ts`).

### Prisma (`prisma/schema.prisma`)
```prisma
model User {
  id    String @id @default(uuid())
  name  String
  email String @unique
}
```

### Drizzle (`src/lib/server/schema.ts`)
```typescript
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
});
```

*Note: In the actual implementation, the existing Prisma models (`Book`, `Chapter`, `TranslationCache`, and `Settings`) were translated to equivalent `pgTable` definitions in `src/lib/server/schema.ts`.*

## 4. Database Connection

Establish a highly performant connection using Drizzle and the `postgres` driver in `src/lib/server/db.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Disable prefetch as it is not supported for "Transaction" pool mode
const queryClient = postgres(env.DATABASE_URL as string, { prepare: false });
export const db = drizzle(queryClient, { schema });
```

## 5. Refactoring SSR Load Functions / API Routes

Fetching data needs to be refactored from Prisma syntax to Drizzle syntax.

### Before (Prisma)
```typescript
// +page.server.ts (example)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function load() {
    const users = await prisma.user.findMany({
        orderBy: { name: 'asc' }
    });
    return { users };
}
```

### After (Drizzle)
```typescript
// +page.server.ts (example)
import { db } from '$lib/server/db';
import { user } from '$lib/server/schema';
import { asc } from 'drizzle-orm';

export async function load() {
    const users = await db.query.user.findMany({
        orderBy: [asc(user.name)]
    });
    return { users };
}
```

*All API routes (`src/routes/api/settings/+server.ts`, `src/routes/api/chapter/+server.ts`, etc.) have been updated accordingly.*

## 6. Migrations

To handle migrations with Drizzle, we've set up `drizzle.config.ts` and added npm scripts to `package.json`.

**Generating Migrations:**
Run this when you change the `schema.ts`:
```bash
npm run db:generate
```
This generates SQL migration files inside the `drizzle/` directory.

**Applying Migrations:**
To quickly apply the schema changes directly to the database without generating files (useful in development), you can use:
```bash
npm run db:push
```

To run a visual database studio:
```bash
npm run db:studio
```
