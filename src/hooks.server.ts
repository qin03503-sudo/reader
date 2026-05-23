import { closeDb } from '$lib/server/db';
import { building } from '$app/environment';

if (!building) {
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing database connections...`);

    // Set a timeout to ensure we exit even if db close hangs
    const timeout = setTimeout(() => {
      console.log('Force closing after timeout');
      process.exit(1);
    }, 1000);

    timeout.unref();

    try {
      await closeDb();
      console.log('Database connections closed successfully.');
    } catch (err) {
      console.error('Error while closing database connections:', err);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
