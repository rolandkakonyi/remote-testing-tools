import { buildApp } from './app.js';
import { serverConfig } from './lib/config.js';
import { cleanupOrphanedDirectories } from './lib/cleanup.js';

async function start(): Promise<void> {
  try {
    await cleanupOrphanedDirectories();
    
    const app = await buildApp(serverConfig);

    const address = await app.listen({
      port: serverConfig.port,
      host: serverConfig.host
    });

    console.log(`🚀 Remote Testing Tools running at ${address}`);
    console.log(`📚 API Documentation available at ${address}/docs`);

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      try {
        await app.close();
        console.log('Server closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();