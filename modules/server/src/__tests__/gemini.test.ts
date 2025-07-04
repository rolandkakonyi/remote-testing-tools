import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn()
}));

// Mock os
vi.mock('os', () => ({
  tmpdir: vi.fn()
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn()
}));

import { execa } from 'execa';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const mockedExeca = execa as MockedFunction<typeof execa>;
const mockedMkdtemp = mkdtemp as MockedFunction<typeof mkdtemp>;
const mockedRm = rm as MockedFunction<typeof rm>;
const mockedTmpdir = tmpdir as MockedFunction<typeof tmpdir>;
const mockedJoin = join as MockedFunction<typeof join>;

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
    
    // Set up default mocks
    mockedTmpdir.mockReturnValue('/tmp');
    mockedJoin.mockImplementation((...parts) => parts.join('/'));
    mockedMkdtemp.mockResolvedValue('/tmp/gemini-abc123');
    mockedRm.mockResolvedValue(undefined);
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

      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['--sandbox'], {
        input: 'Hello world',
        timeout: 30000,
        killSignal: 'SIGTERM',
        cwd: '/tmp/gemini-abc123',
        env: expect.objectContaining({
          PATH: expect.any(String)
        })
      });
      
      // Verify temporary directory operations
      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-abc123', { recursive: true, force: true });
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
      
      // Verify temporary directory operations even when command fails
      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-abc123', { recursive: true, force: true });
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
      expect(mockedMkdtemp).not.toHaveBeenCalled();
      expect(mockedRm).not.toHaveBeenCalled();
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
      expect(mockedMkdtemp).not.toHaveBeenCalled();
      expect(mockedRm).not.toHaveBeenCalled();
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

      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['--sandbox'], {
        input: '123',
        timeout: 30000,
        killSignal: 'SIGTERM',
        cwd: '/tmp/gemini-abc123',
        env: expect.objectContaining({
          PATH: expect.any(String)
        })
      });
      
      // Verify temporary directory operations
      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-abc123', { recursive: true, force: true });
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
      
      // Verify temporary directory operations even when unexpected errors occur
      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-abc123', { recursive: true, force: true });
    });

    it('should create unique temporary directories for concurrent requests', async () => {
      const mockResult = {
        stdout: 'Success',
        stderr: '',
        exitCode: 0
      };

      // Mock different temp directory names for each call
      mockedMkdtemp
        .mockResolvedValueOnce('/tmp/gemini-abc123')
        .mockResolvedValueOnce('/tmp/gemini-def456')
        .mockResolvedValueOnce('/tmp/gemini-ghi789');

      mockedExeca.mockResolvedValue(mockResult as any);

      // Make concurrent requests
      const promises = [
        request(app.server).post('/gemini/ask').send({ prompt: 'Request 1' }),
        request(app.server).post('/gemini/ask').send({ prompt: 'Request 2' }),
        request(app.server).post('/gemini/ask').send({ prompt: 'Request 3' })
      ];

      await Promise.all(promises);

      // Verify each request got its own temporary directory
      expect(mockedMkdtemp).toHaveBeenCalledTimes(3);
      expect(mockedRm).toHaveBeenCalledTimes(3);
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-abc123', { recursive: true, force: true });
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-def456', { recursive: true, force: true });
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-ghi789', { recursive: true, force: true });
    });

    it('should cleanup temp directory even when mkdtemp fails', async () => {
      const mkdtempError = new Error('Failed to create temp directory');
      mockedMkdtemp.mockRejectedValueOnce(mkdtempError);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Hello world' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to create temp directory'
      });

      // Verify execa was not called since mkdtemp failed
      expect(mockedExeca).not.toHaveBeenCalled();
      // Verify rm was not called since no temp directory was created
      expect(mockedRm).not.toHaveBeenCalled();
    });

    it('should continue execution even when cleanup fails', async () => {
      const mockResult = {
        stdout: 'Success despite cleanup failure',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValueOnce(mockResult as any);
      mockedRm.mockRejectedValueOnce(new Error('Cleanup failed'));

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Hello world' })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Success despite cleanup failure',
        exitCode: 0
      });

      // Verify cleanup was attempted
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-abc123', { recursive: true, force: true });
    });

    it('should use correct temp directory path construction', async () => {
      const mockResult = {
        stdout: 'Success',
        stderr: '',
        exitCode: 0
      };

      mockedTmpdir.mockReturnValue('/custom/tmp');
      mockedJoin.mockReturnValue('/custom/tmp/gemini-');
      mockedMkdtemp.mockResolvedValueOnce('/custom/tmp/gemini-xyz999');
      mockedExeca.mockResolvedValueOnce(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Hello world' })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Success',
        exitCode: 0
      });

      // Verify correct path construction
      expect(mockedTmpdir).toHaveBeenCalled();
      expect(mockedJoin).toHaveBeenCalledWith('/custom/tmp', 'gemini-');
      expect(mockedMkdtemp).toHaveBeenCalledWith('/custom/tmp/gemini-');
      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['--sandbox'], {
        input: 'Hello world',
        timeout: 30000,
        killSignal: 'SIGTERM',
        cwd: '/custom/tmp/gemini-xyz999',
        env: expect.objectContaining({
          PATH: expect.any(String)
        })
      });
      expect(mockedRm).toHaveBeenCalledWith('/custom/tmp/gemini-xyz999', { recursive: true, force: true });
    });
  });
});