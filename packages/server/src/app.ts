import Fastify, { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyCors from '@fastify/cors';
import { geminiRoutes } from './routes/gemini.js';
import type { ServerConfig } from './types/index.js';

export async function buildApp(config: ServerConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 1048576, // 1MB
    ajv: {
      customOptions: {
        allErrors: true
      }
    }
  });

  // Register CORS
  await fastify.register(fastifyCors, {
    origin: true
  });

  // Register Swagger
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Local Action Server',
        description: 'A lightweight, extensible server for triggering local command-line actions',
        version: '1.0.0'
      },
      servers: [
        {
          url: `http://${config.host}:${config.port}`,
          description: 'Local development server'
        }
      ]
    }
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    }
  });

  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' }
          }
        }
      }
    }
  }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));

  // Register routes
  await fastify.register(geminiRoutes);

  return fastify;
}