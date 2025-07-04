import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import type { ServerConfig } from '../types/index.js';

config();

const { values } = parseArgs({
  options: {
    port: {
      type: 'string',
      short: 'p',
      default: process.env.PORT || '3000'
    },
    host: {
      type: 'string',
      short: 'h',
      default: process.env.HOST || '127.0.0.1'
    },
    'max-concurrent': {
      type: 'string',
      default: process.env.MAX_CONCURRENT_REQUESTS || '5'
    },
    'request-timeout': {
      type: 'string',
      default: process.env.REQUEST_TIMEOUT || '30000'
    }
  }
});

export const serverConfig: ServerConfig = {
  port: parseInt(values.port as string, 10),
  host: values.host as string,
  maxConcurrentRequests: parseInt(values['max-concurrent'] as string, 10),
  requestTimeout: parseInt(values['request-timeout'] as string, 10)
};