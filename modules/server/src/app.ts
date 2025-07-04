import Fastify, { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyCors from '@fastify/cors';
import { geminiRoutes } from './routes/gemini.js';
import type { ServerConfig } from './types/index.js';
import { mkdir } from 'fs/promises';
import { join } from 'path';

export async function buildApp(config: ServerConfig): Promise<FastifyInstance> {
  // Ensure logs directory exists
  const logsDir = join(process.cwd(), '.logs');
  try {
    await mkdir(logsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }

  // Configure logging based on environment
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  
  const loggerConfig = isTest 
    ? false 
    : {
        level: 'info',
        transport: {
          targets: [
            // File logging for all environments except test
            {
              target: 'pino/file',
              options: {
                destination: join(logsDir, 'app.log')
              }
            },
            // Pretty console output in development
            ...(isDevelopment ? [{
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
              }
            }] : [])
          ]
        }
      };

  const fastify = Fastify({
    logger: loggerConfig,
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
        title: 'Remote Testing Tools',
        description: 'A lightweight, extensible server for triggering local command-line actions in test automation',
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