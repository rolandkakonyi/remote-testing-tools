import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from '../../src/types/index.js';

/**
 * End-to-End Tests for Gemini Integration
 * 
 * These tests require:
 * 1. Actual Gemini CLI installed and available in PATH
 * 2. Gemini API access configured (API key, etc.)
 * 3. Manual execution only - NOT run in CI
 * 
 * To run these tests:
 * 1. Ensure Gemini CLI is installed: npm install -g @google-ai/generativelanguage
 * 2. Configure your API key: export GEMINI_API_KEY=your_key_here
 * 3. Run: npm run test:e2e
 * 
 * These tests verify the complete request/response flow with real Gemini API calls.
 */

describe('Gemini E2E Tests (Manual Only)', () => {
  let app: FastifyInstance;
  
  const testConfig: ServerConfig = {
    port: 0, // Use random available port
    host: '127.0.0.1',
    maxConcurrentRequests: 5,
    requestTimeout: 60000 // Longer timeout for real API calls
  };

  beforeAll(async () => {
    // Check if we're in CI environment and skip if so
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      console.log('Skipping E2E tests in CI environment');
      return;
    }

    // Check if Gemini CLI is available
    try {
      const { execa } = await import('execa');
      await execa('gemini', ['--version'], { timeout: 5000 });
    } catch (error) {
      console.warn('Gemini CLI not available, skipping E2E tests');
      console.warn('Install with: npm install -g @google-ai/generativelanguage');
      return;
    }

    app = await buildApp(testConfig);
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // Skip all tests if in CI or Gemini not available
  const skipCondition = process.env.CI || process.env.GITHUB_ACTIONS;

  describe('Real Gemini CLI Integration', () => {
    it.skipIf(skipCondition)('should handle simple text prompt successfully', async () => {
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({ 
          prompt: 'Say hello and respond with exactly: "E2E Test Success"' 
        })
        .timeout(60000); // 60 second timeout for real API calls

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('exitCode');
      expect(response.body.exitCode).toBe(0);
      expect(response.body.output).toContain('E2E Test Success');
    });

    it.skipIf(skipCondition)('should handle file attachment with image analysis', async () => {
      // Create a simple 1x1 pixel PNG image (Base64 encoded)
      const simplePixelPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({
          prompt: 'Analyze this image and describe what you see. Respond with "Image analysis complete" at the end.',
          files: [
            {
              fileName: 'test-image.png',
              data: simplePixelPNG
            }
          ]
        })
        .timeout(60000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('exitCode');
      expect(response.body.exitCode).toBe(0);
      expect(response.body.output).toContain('Image analysis complete');
    });

    it.skipIf(skipCondition)('should handle text file attachment', async () => {
      const textContent = 'This is a test file for E2E testing.\nIt contains multiple lines.\nEnd of test file.';
      const base64Content = Buffer.from(textContent).toString('base64');
      
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({
          prompt: 'Read the attached text file and summarize its content. End your response with "File summary complete".',
          files: [
            {
              fileName: 'test-document.txt',
              data: base64Content
            }
          ]
        })
        .timeout(60000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('exitCode');
      expect(response.body.exitCode).toBe(0);
      expect(response.body.output).toContain('File summary complete');
    });

    it.skipIf(skipCondition)('should handle multiple file attachments', async () => {
      const file1Content = Buffer.from('First test file content').toString('base64');
      const file2Content = Buffer.from('{"name": "test", "type": "json"}').toString('base64');
      
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({
          prompt: 'You have been provided with two files. Analyze both and confirm you can see them. End with "Multiple files processed".',
          files: [
            {
              fileName: 'file1.txt',
              data: file1Content
            },
            {
              fileName: 'data.json',
              data: file2Content
            }
          ]
        })
        .timeout(60000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('exitCode');
      expect(response.body.exitCode).toBe(0);
      expect(response.body.output).toContain('Multiple files processed');
    });


    it.skipIf(skipCondition)('should handle complex prompt with code analysis', async () => {
      const codeContent = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
      `.trim();
      
      const base64Code = Buffer.from(codeContent).toString('base64');
      
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({
          prompt: 'Analyze this JavaScript code and explain what it does. End with "Code analysis finished".',
          files: [
            {
              fileName: 'fibonacci.js',
              data: base64Code
            }
          ]
        })
        .timeout(60000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('exitCode');
      expect(response.body.exitCode).toBe(0);
      expect(response.body.output).toContain('Code analysis finished');
      expect(response.body.output.toLowerCase()).toContain('fibonacci');
    });

    it.skipIf(skipCondition)('should validate files are accessible in temp working directory', async () => {
      // Create a test file that validates directory listing and file access
      const testContent = 'VALIDATION_SUCCESS: Files are accessible in temp directory';
      const base64Content = Buffer.from(testContent).toString('base64');
      
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({
          prompt: 'I need you to verify that the uploaded file is accessible in your current working directory. Please: 1) List the files in the current directory, 2) Read the content of validation.txt, 3) Confirm the exact content matches "VALIDATION_SUCCESS: Files are accessible in temp directory". End your response with "TEMP_DIR_VALIDATION_COMPLETE".',
          files: [
            {
              fileName: 'validation.txt',
              data: base64Content
            }
          ]
        })
        .timeout(60000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('exitCode');
      expect(response.body.exitCode).toBe(0);
      expect(response.body.output).toContain('TEMP_DIR_VALIDATION_COMPLETE');
      expect(response.body.output).toContain('validation.txt');
      expect(response.body.output).toContain('VALIDATION_SUCCESS: Files are accessible in temp directory');
    });
  });

  describe('Error Handling in Real Environment', () => {

    it.skipIf(skipCondition)('should handle very large file attachments', async () => {
      // Create a larger file (1MB of text)
      const largeContent = 'A'.repeat(1024 * 1024);
      const base64Content = Buffer.from(largeContent).toString('base64');
      
      const response = await request(app.server)
        .post('/gemini/ask')
        .send({
          prompt: 'This file is quite large. Just respond with "Large file handled" if you can process it.',
          files: [
            {
              fileName: 'large-file.txt',
              data: base64Content
            }
          ]
        })
        .timeout(120000); // Longer timeout for large files

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('exitCode');
      // Note: This might fail if the file is too large for Gemini API limits
      // That's expected behavior we want to test
    });
  });

  describe('Performance and Concurrency', () => {
    it.skipIf(skipCondition)('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        request(app.server)
          .post('/gemini/ask')
          .send({
            prompt: `Concurrent test ${i + 1}. Respond with exactly: "Concurrent response ${i + 1}"`
          })
          .timeout(60000)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('output');
        expect(response.body).toHaveProperty('exitCode');
        expect(response.body.exitCode).toBe(0);
        expect(response.body.output).toContain(`Concurrent response ${i + 1}`);
      });
    });
  });
});