import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

import { execa } from 'execa';
const mockedExeca = execa as MockedFunction<typeof execa>;

describe('Gemini Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({
      port: 0,
      host: '127.0.0.1',
      maxConcurrentRequests: 5,
      requestTimeout: 30000
    });
    await app.ready();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /gemini/ask', () => {
    it('should execute gemini command successfully', async () => {
      const mockResult = {
        stdout: 'Hello from Gemini!',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValueOnce(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Hello world' })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Hello from Gemini!',
        exitCode: 0
      });

      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['Hello world'], {
        timeout: 30000,
        killSignal: 'SIGTERM'
      });
    });

    it('should execute gemini command with additional args', async () => {
      const mockResult = {
        stdout: 'Response with args',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValueOnce(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Hello world',
          args: ['--verbose', '--format=json']
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Response with args',
        exitCode: 0
      });

      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['Hello world', '--verbose', '--format=json'], {
        timeout: 30000,
        killSignal: 'SIGTERM'
      });
    });

    it('should handle gemini command errors', async () => {
      const mockError = {
        stdout: '',
        stderr: 'Command not found',
        exitCode: 127,
        message: 'Command failed with exit code 127'
      };

      mockedExeca.mockRejectedValueOnce(mockError);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Hello world' })
        .expect(200);

      expect(response.body).toEqual({
        output: '',
        exitCode: 127,
        stderr: 'Command not found',
        error: 'Command failed with exit code 127'
      });
    });

    it('should return 400 for missing prompt', async () => {
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Prompt is required and must be a non-empty string'
      });

      expect(mockedExeca).not.toHaveBeenCalled();
    });

    it('should return 400 for empty prompt', async () => {
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: '   ' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Prompt is required and must be a non-empty string'
      });

      expect(mockedExeca).not.toHaveBeenCalled();
    });

    it('should handle non-string prompt by converting to string', async () => {
      const mockResult = {
        stdout: 'Response to 123',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValueOnce(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 123 })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Response to 123',
        exitCode: 0
      });

      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['123'], {
        timeout: 30000,
        killSignal: 'SIGTERM'
      });
    });

    it('should handle unexpected errors', async () => {
      const mockError = new Error('Unexpected error');
      mockedExeca.mockRejectedValueOnce(mockError);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Hello world' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Unexpected error'
      });
    });
  });
});