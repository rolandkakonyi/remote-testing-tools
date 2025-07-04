export interface GeminiRequestFile {
  fileName: string;
  data: string; // base64 encoded
}

export interface GeminiRequest {
  prompt: string;
  args?: string[];
  files?: GeminiRequestFile[];
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