import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { execa } from 'execa';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { defaultQueue } from '../lib/queue.js';
import type { GeminiRequest, GeminiResponse } from '../types/index.js';

const fileSchema = {
  type: 'object',
  properties: {
    fileName: { type: 'string' },
    data: { type: 'string' }
  },
  required: ['fileName', 'data']
} as const;

const geminiRequestSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    files: {
      type: 'array',
      items: fileSchema
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
        description: 'Execute a Gemini CLI command with the provided prompt and optional file attachments.',
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
      let { prompt, files = [] } = request.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return reply.status(400).send({ error: 'Prompt is required and must be a non-empty string' });
      }

      try {
        const result = await defaultQueue.add(async () => {
          let tempDir: string | undefined;
          
          try {
            // Create a new temporary directory for this request
            tempDir = await mkdtemp(join(tmpdir(), 'gemini-'));

            // Handle file attachments
            if (files && files.length > 0) {
              for (const file of files) {
                const decodedData = Buffer.from(file.data, 'base64');
                await writeFile(join(tempDir, file.fileName), decodedData);
              }
              const fileNames = files.map(f => `@${f.fileName}`).join(' ');
              prompt = `Here are the user provided files for context: ${fileNames}\n\n${prompt}`;
            }
            
            const geminiArgs = ['--sandbox'];
            
            // Execute and wait for completion, passing through authentication
            // Pass prompt via stdin instead of --prompt flag
            const result = await execa('gemini', geminiArgs, {
              input: prompt, // Pass prompt via stdin
              timeout: 30000,
              killSignal: 'SIGTERM',
              cwd: tempDir,
              env: {
                ...process.env, // Pass through all environment variables including GEMINI_API_KEY
                PATH: process.env.PATH // Ensure PATH is available for finding gemini binary
              }
            });

            return result;
          } finally {
            // Clean up temporary directory after process completes
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