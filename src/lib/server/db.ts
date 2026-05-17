import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Disable prefetch as it is not supported for "Transaction" pool mode
const queryClient = postgres(env.DATABASE_URL as string, { prepare: false });
export const db = drizzle(queryClient, { schema });
