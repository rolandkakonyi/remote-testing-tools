import { writeFileSync } from 'fs';
import { buildApp } from './app.js';

async function generateOpenAPISpec(): Promise<void> {
  try {
    const app = await buildApp({
      port: 0,
      host: '127.0.0.1',
      maxConcurrentRequests: 5,
      requestTimeout: 30000
    });

    await app.ready();

    const spec = app.swagger();
    writeFileSync('./openapi.json', JSON.stringify(spec, null, 2));

    console.log('✅ OpenAPI specification generated successfully at ./openapi.json');
    
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI specification:', error);
    process.exit(1);
  }
}

generateOpenAPISpec();