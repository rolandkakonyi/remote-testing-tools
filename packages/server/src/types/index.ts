export interface GeminiRequest {
  prompt: string;
  args?: string[];
}

export interface GeminiResponse {
  output: string;
  exitCode: number;
  stderr?: string;
  error?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  maxConcurrentRequests: number;
  requestTimeout: number;
}