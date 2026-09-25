import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`
  =============================================================
   🚀 OBSIDIAN Storefront Backend API Service
  =============================================================
   Environment:  ${env.NODE_ENV}
   Port:         ${env.PORT}
   URL:          http://localhost:${env.PORT}
   Health:       http://localhost:${env.PORT}/health
   Allowed CORS: ${env.ALLOWED_ORIGIN}
  =============================================================
  `);
});

// Graceful shutdown handling
const handleShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
