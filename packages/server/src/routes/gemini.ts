import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { execa } from 'execa';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { defaultQueue } from '../lib/queue.js';
import type { GeminiRequest, GeminiResponse } from '../types/index.js';

const geminiRequestSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    args: {
      type: 'array',
      items: { type: 'string' }
    }
  }
} as const;

const geminiResponseSchema = {
  type: 'object',
  properties: {
    output: { type: 'string' },
    exitCode: { type: 'number' },
    stderr: { type: 'string' },
    error: { type: 'string' }
  }
} as const;

export async function geminiRoutes(fastify: FastifyInstance): Promise<void> {
  // Route for executing Gemini CLI commands
  fastify.post<{ Body: GeminiRequest; Reply: GeminiResponse }>(
    '/gemini/ask',
    {
      schema: {
        description: 'Execute a Gemini CLI command with the provided prompt',
        tags: ['gemini'],
        body: geminiRequestSchema,
        response: {
          200: geminiResponseSchema,
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: GeminiRequest }>, reply: FastifyReply) => {
      const { prompt, args = [] } = request.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return reply.status(400).send({ error: 'Prompt is required and must be a non-empty string' });
      }

      try {
        const result = await defaultQueue.add(async () => {
          let tempDir: string | undefined;
          
          try {
            // Create a new temporary directory for this request
            tempDir = await mkdtemp(join(tmpdir(), 'gemini-'));
            
            const geminiArgs = [prompt, ...args];
            
            const subprocess = execa('gemini', geminiArgs, {
              timeout: 30000,
              killSignal: 'SIGTERM',
              cwd: tempDir
            });

            return subprocess;
          } finally {
            // Clean up temporary directory
            if (tempDir) {
              try {
                await rm(tempDir, { recursive: true, force: true });
              } catch (cleanupError) {
                // Log cleanup errors but don't fail the request
                fastify.log.warn({ error: cleanupError, tempDir }, 'Failed to cleanup temporary directory');
              }
            }
          }
        });

        const response: GeminiResponse = {
          output: result.stdout,
          exitCode: result.exitCode,
          stderr: result.stderr || undefined
        };

        return reply.send(response);
      } catch (error) {
        fastify.log.error(error);
        
        if (error && typeof error === 'object' && 'exitCode' in error) {
          const execaError = error as any;
          const response: GeminiResponse = {
            output: execaError.stdout || '',
            exitCode: execaError.exitCode || 1,
            stderr: execaError.stderr || undefined,
            error: execaError.message
          };
          return reply.send(response);
        }

        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
  );
}