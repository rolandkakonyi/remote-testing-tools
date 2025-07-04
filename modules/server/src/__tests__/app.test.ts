import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Remote Testing Tools', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({
      port: 0,
      host: '127.0.0.1',
      maxConcurrentRequests: 5,
      requestTimeout: 30000
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.server)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('OpenAPI Documentation', () => {
    it('should serve OpenAPI spec', async () => {
      const response = await request(app.server)
        .get('/docs/json')
        .expect(200);

      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body.info.title).toBe('Remote Testing Tools');
    });

    it('should serve Swagger UI', async () => {
      await request(app.server)
        .get('/docs/')
        .expect(302);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app.server)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('vary', 'Origin');
    });
  });
});