import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { geminiRoutes } from '../gemini.js';

// Mock external dependencies
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('fs/promises', () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn()
}));

vi.mock('os', () => ({
  tmpdir: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn()
}));

vi.mock('../../lib/queue.js', () => ({
  defaultQueue: {
    add: vi.fn()
  }
}));

import { execa } from 'execa';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { defaultQueue } from '../../lib/queue.js';

const mockedExeca = execa as MockedFunction<typeof execa>;
const mockedMkdtemp = mkdtemp as MockedFunction<typeof mkdtemp>;
const mockedRm = rm as MockedFunction<typeof rm>;
const mockedWriteFile = writeFile as MockedFunction<typeof writeFile>;
const mockedTmpdir = tmpdir as MockedFunction<typeof tmpdir>;
const mockedJoin = join as MockedFunction<typeof join>;
const mockedQueue = defaultQueue as { add: MockedFunction<any> };

describe('Gemini Route Handler (Unit Tests)', () => {
  let mockFastify: FastifyInstance;
  let mockRequest: FastifyRequest;
  let mockReply: FastifyReply;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Fastify instance
    mockFastify = {
      post: vi.fn(),
      log: {
        error: vi.fn(),
        warn: vi.fn()
      }
    } as any;

    // Mock request and reply objects
    mockRequest = {
      body: {}
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    } as any;

    // Set up default mocks
    mockedTmpdir.mockReturnValue('/tmp');
    mockedJoin.mockImplementation((...parts) => parts.join('/'));
    mockedMkdtemp.mockResolvedValue('/tmp/gemini-test123');
    mockedRm.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
  });

  describe('Route Registration', () => {
    it('should register the POST /gemini/ask route', async () => {
      await geminiRoutes(mockFastify);

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/gemini/ask',
        expect.objectContaining({
          schema: expect.objectContaining({
            description: 'Execute a Gemini CLI command with the provided prompt and optional file attachments.',
            tags: ['gemini']
          })
        }),
        expect.any(Function)
      );
    });
  });

  describe('Route Handler Logic', () => {
    let routeHandler: Function;

    beforeEach(async () => {
      await geminiRoutes(mockFastify);
      routeHandler = (mockFastify.post as MockedFunction<any>).mock.calls[0][2];
    });

    it('should validate prompt is required', async () => {
      mockRequest.body = {};

      await routeHandler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Prompt is required and must be a non-empty string'
      });
    });

    it('should validate prompt is non-empty string', async () => {
      mockRequest.body = { prompt: '   ' };

      await routeHandler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Prompt is required and must be a non-empty string'
      });
    });

    it('should handle valid request with prompt only', async () => {
      const mockResult = {
        stdout: 'Test output',
        stderr: '',
        exitCode: 0
      };

      mockedQueue.add.mockImplementation(async (fn) => await fn());
      mockedExeca.mockResolvedValue(mockResult as any);

      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        output: 'Test output',
        exitCode: 0
      });
    });


    it('should handle execa errors with exit code', async () => {
      const mockError = {
        stdout: '',
        stderr: 'Command not found',
        exitCode: 127,
        message: 'Command failed'
      };

      mockedQueue.add.mockImplementation(async (fn) => await fn());
      mockedExeca.mockRejectedValue(mockError);

      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        output: '',
        exitCode: 127,
        stderr: 'Command not found',
        error: 'Command failed'
      });
    });

    it('should handle unexpected errors', async () => {
      const mockError = new Error('Unexpected error');

      mockedQueue.add.mockRejectedValue(mockError);
      
      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unexpected error'
      });
    });

    it('should handle non-Error objects in catch block', async () => {
      const mockError = 'String error';

      mockedQueue.add.mockRejectedValue(mockError);
      
      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unknown error occurred'
      });
    });

    it('should create temporary directory and execute gemini with correct args', async () => {
      const mockResult = {
        stdout: 'Success',
        stderr: '',
        exitCode: 0
      };

      mockedQueue.add.mockImplementation(async (fn) => {
        return await fn();
      });
      mockedExeca.mockResolvedValue(mockResult as any);

      mockRequest.body = { 
        prompt: 'Test prompt'
      };

      await routeHandler(mockRequest, mockReply);

      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedExeca).toHaveBeenCalledWith('gemini', ['--sandbox'], {
        input: 'Test prompt',
        timeout: 30000,
        killSignal: 'SIGTERM',
        cwd: '/tmp/gemini-test123',
        env: expect.objectContaining({
          PATH: expect.any(String)
        })
      });
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-test123', { recursive: true, force: true });
    });

    it('should cleanup temp directory even when execa fails', async () => {
      const mockError = new Error('Command failed');

      mockedQueue.add.mockImplementation(async (fn) => await fn());
      mockedExeca.mockRejectedValue(mockError);

      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockedMkdtemp).toHaveBeenCalledWith('/tmp/gemini-');
      expect(mockedRm).toHaveBeenCalledWith('/tmp/gemini-test123', { recursive: true, force: true });
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockResult = {
        stdout: 'Success',
        stderr: '',
        exitCode: 0
      };

      mockedQueue.add.mockImplementation(async (fn) => await fn());
      mockedExeca.mockResolvedValue(mockResult as any);
      mockedRm.mockRejectedValue(new Error('Cleanup failed'));

      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          tempDir: '/tmp/gemini-test123'
        }),
        'Failed to cleanup temporary directory'
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        output: 'Success',
        exitCode: 0
      });
    });

    it('should include stderr in response when present', async () => {
      const mockResult = {
        stdout: 'Output with warnings',
        stderr: 'Warning message',
        exitCode: 0
      };

      mockedQueue.add.mockImplementation(async (fn) => await fn());
      mockedExeca.mockResolvedValue(mockResult as any);

      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        output: 'Output with warnings',
        exitCode: 0,
        stderr: 'Warning message'
      });
    });

    it('should not include stderr in response when empty', async () => {
      const mockResult = {
        stdout: 'Clean output',
        stderr: '',
        exitCode: 0
      };

      mockedQueue.add.mockImplementation(async (fn) => await fn());
      mockedExeca.mockResolvedValue(mockResult as any);

      mockRequest.body = { prompt: 'Test prompt' };

      await routeHandler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        output: 'Clean output',
        exitCode: 0
      });
    });

    describe('File Attachment Tests', () => {
      it('should handle file attachments correctly', async () => {
        const mockResult = {
          stdout: 'Output with files',
          stderr: '',
          exitCode: 0
        };

        mockedQueue.add.mockImplementation(async (fn) => await fn());
        mockedExeca.mockResolvedValue(mockResult as any);

        const testFile = {
          fileName: 'test.txt',
          data: Buffer.from('Hello World').toString('base64')
        };

        mockRequest.body = { 
          prompt: 'Test prompt',
          files: [testFile]
        };

        await routeHandler(mockRequest, mockReply);

        expect(mockedWriteFile).toHaveBeenCalledWith(
          '/tmp/gemini-test123/test.txt',
          Buffer.from('Hello World')
        );
        expect(mockedExeca).toHaveBeenCalledWith(
          'gemini',
          ['--sandbox'],
          {
            input: 'Here are the user provided files for context: @test.txt\n\nTest prompt',
            timeout: 30000,
            killSignal: 'SIGTERM',
            cwd: '/tmp/gemini-test123',
            env: expect.objectContaining({
              PATH: expect.any(String)
            })
          }
        );
        expect(mockReply.send).toHaveBeenCalledWith({
          output: 'Output with files',
          exitCode: 0
        });
      });

      it('should handle multiple file attachments', async () => {
        const mockResult = {
          stdout: 'Output with multiple files',
          stderr: '',
          exitCode: 0
        };

        mockedQueue.add.mockImplementation(async (fn) => await fn());
        mockedExeca.mockResolvedValue(mockResult as any);

        const testFiles = [
          {
            fileName: 'file1.txt',
            data: Buffer.from('File 1 content').toString('base64')
          },
          {
            fileName: 'file2.png',
            data: Buffer.from('PNG data').toString('base64')
          }
        ];

        mockRequest.body = { 
          prompt: 'Test prompt',
          files: testFiles
        };

        await routeHandler(mockRequest, mockReply);

        expect(mockedWriteFile).toHaveBeenCalledWith(
          '/tmp/gemini-test123/file1.txt',
          Buffer.from('File 1 content')
        );
        expect(mockedWriteFile).toHaveBeenCalledWith(
          '/tmp/gemini-test123/file2.png',
          Buffer.from('PNG data')
        );
        expect(mockedExeca).toHaveBeenCalledWith(
          'gemini',
          ['--sandbox'],
          {
            input: 'Here are the user provided files for context: @file1.txt @file2.png\n\nTest prompt',
            timeout: 30000,
            killSignal: 'SIGTERM',
            cwd: '/tmp/gemini-test123',
            env: expect.objectContaining({
              PATH: expect.any(String)
            })
          }
        );
      });

      it('should handle requests without files', async () => {
        const mockResult = {
          stdout: 'Output without files',
          stderr: '',
          exitCode: 0
        };

        mockedQueue.add.mockImplementation(async (fn) => await fn());
        mockedExeca.mockResolvedValue(mockResult as any);

        mockRequest.body = { 
          prompt: 'Test prompt',
          files: []
        };

        await routeHandler(mockRequest, mockReply);

        expect(mockedWriteFile).not.toHaveBeenCalled();
        expect(mockedExeca).toHaveBeenCalledWith(
          'gemini',
          ['--sandbox'],
          {
            input: 'Test prompt',
            timeout: 30000,
            killSignal: 'SIGTERM',
            cwd: '/tmp/gemini-test123',
            env: expect.objectContaining({
              PATH: expect.any(String)
            })
          }
        );
      });

      it('should handle requests with undefined files', async () => {
        const mockResult = {
          stdout: 'Output without files',
          stderr: '',
          exitCode: 0
        };

        mockedQueue.add.mockImplementation(async (fn) => await fn());
        mockedExeca.mockResolvedValue(mockResult as any);

        mockRequest.body = { 
          prompt: 'Test prompt'
          // files is undefined
        };

        await routeHandler(mockRequest, mockReply);

        expect(mockedWriteFile).not.toHaveBeenCalled();
        expect(mockedExeca).toHaveBeenCalledWith(
          'gemini',
          ['--sandbox'],
          {
            input: 'Test prompt',
            timeout: 30000,
            killSignal: 'SIGTERM',
            cwd: '/tmp/gemini-test123',
            env: expect.objectContaining({
              PATH: expect.any(String)
            })
          }
        );
      });
    });
  });
});