import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from '../../src/types/index.js';

// Mock execa to prevent actual process execution
vi.mock('execa', () => ({
  execa: vi.fn()
}));

// Mock fs/promises to control temp directory operations
vi.mock('fs/promises', () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn()
}));

// Mock os to control temp directory location
vi.mock('os', () => ({
  tmpdir: vi.fn()
}));

// Mock path to control path operations
vi.mock('path', () => ({
  join: vi.fn()
}));

import { execa } from 'execa';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const mockedExeca = execa as MockedFunction<typeof execa>;
const mockedMkdtemp = mkdtemp as MockedFunction<typeof mkdtemp>;
const mockedRm = rm as MockedFunction<typeof rm>;
const mockedWriteFile = writeFile as MockedFunction<typeof writeFile>;
const mockedTmpdir = tmpdir as MockedFunction<typeof tmpdir>;
const mockedJoin = join as MockedFunction<typeof join>;

describe('Gemini Integration Tests', () => {
  let app: FastifyInstance;
  
  const testConfig: ServerConfig = {
    port: 0,
    host: '127.0.0.1',
    maxConcurrentRequests: 5,
    requestTimeout: 30000
  };

  beforeEach(async () => {
    // Build the app with test configuration
    app = await buildApp(testConfig);
    await app.ready();
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Set up default mock implementations
    mockedTmpdir.mockReturnValue('/tmp');
    mockedJoin.mockImplementation((...parts) => parts.join('/'));
    mockedMkdtemp.mockResolvedValue('/tmp/gemini-integration-test');
    mockedRm.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /gemini/ask - Full Request/Response Lifecycle', () => {
    it('should handle successful gemini execution with 200 status', async () => {
      const mockResult = {
        stdout: 'Integration test success',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Test integration prompt' })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Integration test success',
        exitCode: 0
      });

      // Verify execa was called with correct arguments including --sandbox and cwd
      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['--sandbox', 'Test integration prompt'], {
        timeout: 30000,
        killSignal: 'SIGTERM',
        cwd: '/tmp/gemini-integration-test'
      });
    });

    it('should handle gemini execution with additional args', async () => {
      const mockResult = {
        stdout: 'Integration test with args',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Test prompt',
          args: ['--verbose', '--format=json']
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Integration test with args',
        exitCode: 0
      });

      // Verify execa was called with correct arguments
      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['--sandbox', 'Test prompt', '--verbose', '--format=json'], {
        timeout: 30000,
        killSignal: 'SIGTERM',
        cwd: '/tmp/gemini-integration-test'
      });
    });

    it('should handle gemini command errors and return 200 with error details', async () => {
      const mockError = {
        stdout: 'Partial output',
        stderr: 'Error message',
        exitCode: 1,
        message: 'Command failed with exit code 1'
      };

      mockedExeca.mockRejectedValue(mockError);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Test prompt' })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Partial output',
        exitCode: 1,
        stderr: 'Error message',
        error: 'Command failed with exit code 1'
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

      // Verify execa was not called
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

      // Verify execa was not called
      expect(mockedExeca).not.toHaveBeenCalled();
    });

    it('should accept non-string prompt and convert to string', async () => {
      const mockResult = {
        stdout: 'Response to 123',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 123 })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Response to 123',
        exitCode: 0
      });

      // Verify execa was called with string version
      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['--sandbox', '123'], {
        timeout: 30000,
        killSignal: 'SIGTERM',
        cwd: '/tmp/gemini-integration-test'
      });
    });

    it('should return 500 for unexpected errors', async () => {
      const mockError = new Error('Unexpected system error');

      mockedExeca.mockRejectedValue(mockError);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Test prompt' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Unexpected system error'
      });
    });

    it('should handle stderr in response correctly', async () => {
      const mockResult = {
        stdout: 'Output with warnings',
        stderr: 'Warning: deprecated feature',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Test prompt' })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Output with warnings',
        exitCode: 0,
        stderr: 'Warning: deprecated feature'
      });
    });

    it('should omit stderr when empty', async () => {
      const mockResult = {
        stdout: 'Clean output',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Test prompt' })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Clean output',
        exitCode: 0
      });
    });

    it('should handle concurrent requests properly', async () => {
      const mockResult = {
        stdout: 'Concurrent success',
        stderr: '',
        exitCode: 0
      };

      // Mock unique temp directories for each request
      mockedMkdtemp
        .mockResolvedValueOnce('/tmp/gemini-concurrent-1')
        .mockResolvedValueOnce('/tmp/gemini-concurrent-2')
        .mockResolvedValueOnce('/tmp/gemini-concurrent-3');

      mockedExeca.mockResolvedValue(mockResult as any);

      // Make concurrent requests
      const promises = [
        request(app.server).post('/gemini/ask').send({ prompt: 'Request 1' }),
        request(app.server).post('/gemini/ask').send({ prompt: 'Request 2' }),
        request(app.server).post('/gemini/ask').send({ prompt: 'Request 3' })
      ];

      const responses = await Promise.all(promises);

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          output: 'Concurrent success',
          exitCode: 0
        });
      });

      // Verify temp directories were created and cleaned up
      expect(mockedMkdtemp).toHaveBeenCalledTimes(3);
      expect(mockedRm).toHaveBeenCalledTimes(3);
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-concurrent-1', { recursive: true, force: true });
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-concurrent-2', { recursive: true, force: true });
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-concurrent-3', { recursive: true, force: true });
    });
  });

  describe('Request Validation', () => {
    it('should handle invalid content type with 415 error', async () => {
      const response = await request(app.server)
        .post('/gemini/ask')
        .send('invalid json')
        .expect(415);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app.server)
        .post('/gemini/ask')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid args array', async () => {
      const mockResult = {
        stdout: 'Success with args',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Test prompt',
          args: ['--flag1', '--flag2=value']
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Success with args',
        exitCode: 0
      });
    });

    it('should handle empty args array', async () => {
      const mockResult = {
        stdout: 'Success with empty args',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Test prompt',
          args: []
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Success with empty args',
        exitCode: 0
      });
    });
  });

  describe('Temporary Directory Management', () => {
    it('should verify temp directory creation and cleanup', async () => {
      const mockResult = {
        stdout: 'Success',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Test prompt' })
        .expect(200);

      // Verify temp directory operations
      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-integration-test', { recursive: true, force: true });
    });

    it('should still cleanup when execa fails', async () => {
      const mockError = new Error('Command failed');
      mockedExeca.mockRejectedValue(mockError);

      await request(app.server)
        .post('/gemini/ask')
        .send({ prompt: 'Test prompt' })
        .expect(500);

      // Verify cleanup still occurred
      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-integration-test', { recursive: true, force: true });
    });
  });

  describe('File Attachment Integration Tests', () => {
    it('should handle file attachments with Base64 data', async () => {
      const mockResult = {
        stdout: 'Output with files',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const testFile = {
        fileName: 'test.txt',
        data: Buffer.from('Test file content').toString('base64')
      };

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Analyze this file',
          files: [testFile]
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Output with files',
        exitCode: 0
      });

      // Verify file was written to temp directory
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/tmp/gemini-integration-test/test.txt',
        Buffer.from('Test file content')
      );

      // Verify prompt was modified with file context
      expect(mockedExeca).toHaveBeenCalledWith(
        'gemini',
        ['--sandbox', 'Here are the user provided files for context: @test.txt\n\nAnalyze this file'],
        {
          timeout: 30000,
          killSignal: 'SIGTERM',
          cwd: '/tmp/gemini-integration-test'
        }
      );
    });

    it('should handle multiple file attachments', async () => {
      const mockResult = {
        stdout: 'Output with multiple files',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const testFiles = [
        {
          fileName: 'file1.txt',
          data: Buffer.from('Content 1').toString('base64')
        },
        {
          fileName: 'file2.json',
          data: Buffer.from('{"key": "value"}').toString('base64')
        }
      ];

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Compare these files',
          files: testFiles
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Output with multiple files',
        exitCode: 0
      });

      // Verify both files were written
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/tmp/gemini-integration-test/file1.txt',
        Buffer.from('Content 1')
      );
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/tmp/gemini-integration-test/file2.json',
        Buffer.from('{"key": "value"}')
      );

      // Verify prompt was modified with both files
      expect(mockedExeca).toHaveBeenCalledWith(
        'gemini',
        ['--sandbox', 'Here are the user provided files for context: @file1.txt @file2.json\n\nCompare these files'],
        {
          timeout: 30000,
          killSignal: 'SIGTERM',
          cwd: '/tmp/gemini-integration-test'
        }
      );
    });

    it('should handle empty files array', async () => {
      const mockResult = {
        stdout: 'Output without files',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'No files here',
          files: []
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Output without files',
        exitCode: 0
      });

      // Verify no files were written
      expect(mockedWriteFile).not.toHaveBeenCalled();

      // Verify prompt was not modified
      expect(mockedExeca).toHaveBeenCalledWith(
        'gemini',
        ['--sandbox', 'No files here'],
        {
          timeout: 30000,
          killSignal: 'SIGTERM',
          cwd: '/tmp/gemini-integration-test'
        }
      );
    });

    it('should handle missing files property', async () => {
      const mockResult = {
        stdout: 'Output without files',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'No files property'
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Output without files',
        exitCode: 0
      });

      // Verify no files were written
      expect(mockedWriteFile).not.toHaveBeenCalled();

      // Verify prompt was not modified
      expect(mockedExeca).toHaveBeenCalledWith(
        'gemini',
        ['--sandbox', 'No files property'],
        {
          timeout: 30000,
          killSignal: 'SIGTERM',
          cwd: '/tmp/gemini-integration-test'
        }
      );
    });

    it('should handle binary file attachments', async () => {
      const mockResult = {
        stdout: 'Image processed',
        stderr: '',
        exitCode: 0
      };

      mockedExeca.mockResolvedValue(mockResult as any);

      // Simulate binary PNG data
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const testFile = {
        fileName: 'image.png',
        data: binaryData.toString('base64')
      };

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Analyze this image',
          files: [testFile]
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Image processed',
        exitCode: 0
      });

      // Verify binary file was written correctly
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/tmp/gemini-integration-test/image.png',
        binaryData
      );
    });

    it('should handle file attachments with command errors', async () => {
      const mockError = {
        stdout: 'Partial output',
        stderr: 'File processing error',
        exitCode: 1,
        message: 'Command failed'
      };

      mockedExeca.mockRejectedValue(mockError);

      const testFile = {
        fileName: 'test.txt',
        data: Buffer.from('Test content').toString('base64')
      };

      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Process this file',
          files: [testFile]
        })
        .expect(200);

      expect(response.body).toEqual({
        output: 'Partial output',
        exitCode: 1,
        stderr: 'File processing error',
        error: 'Command failed'
      });

      // Verify file was still written despite error
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/tmp/gemini-integration-test/test.txt',
        Buffer.from('Test content')
      );

      // Verify cleanup still occurred
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-integration-test', { recursive: true, force: true });
    });
  });
});