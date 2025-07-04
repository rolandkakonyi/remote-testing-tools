import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.e2e.test.ts'],
    testTimeout: 120000, // 2 minutes for real API calls
    hookTimeout: 30000,  // 30 seconds for setup/teardown
    // Don't run in parallel to avoid overwhelming the API
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
});