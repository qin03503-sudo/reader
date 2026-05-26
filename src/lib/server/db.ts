import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Singleton for Postgres client to prevent hot-reload connection leaks
const globalForPostgres = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined;
};

const queryClient = globalForPostgres.queryClient ?? postgres(env.DATABASE_URL as string, { prepare: false });

if (process.env.NODE_ENV !== 'production') globalForPostgres.queryClient = queryClient;

export const db = drizzle(queryClient, { schema });

export const closeDb = async () => {
  await queryClient.end({ timeout: 5 });
};
