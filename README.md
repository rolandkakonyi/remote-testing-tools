# Remote Testing Tools

A lightweight, extensible server designed to run on a local machine or within a private CI network. Its purpose is to provide an API that triggers local command-line actions, acting as a bridge for E2E tests or other automated tools.

## Features

- **Ephemeral Lifecycle**: Designed to be started on-demand for specific tasks
- **Trusted Environment**: Built for developer machines or isolated CI runners
- **Extensible Architecture**: Simple framework for adding new actions over time
- **TypeScript & Fastify**: Modern, fast, and type-safe implementation
- **Swift Client**: Auto-generated Swift Package Manager compatible client
- **File Attachments**: Support for sending files as Base64-encoded context
- **Sandbox Execution**: Enhanced security with isolated temporary directories
- **Comprehensive Logging**: File-based logging for debugging with structured JSON logs

## Quick Start

### Running the Server

```bash
# Via npx (recommended)
npx github:yourusername/remote-testing-tools remote-testing-tools

# Or clone and run locally
git clone https://github.com/yourusername/remote-testing-tools.git
cd remote-testing-tools
yarn install
yarn dev
```

### Using the API

The server provides a REST API with OpenAPI documentation available at `/docs`.

#### Ask Gemini

```bash
# Simple text prompt
curl -X POST http://localhost:3000/gemini/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the capital of France?"}'

# With file attachments
curl -X POST http://localhost:3000/gemini/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this image",
    "files": [
      {
        "fileName": "chart.png",
        "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
      }
    ]
  }'
```

### Swift Client

Add the Swift client to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/yourusername/remote-testing-tools.git", from: "1.0.0")
]
```

Then import and use:

```swift
import RemoteTestToolsClient

let client = RemoteTestToolsClient(basePath: "http://localhost:3000")

// Simple text prompt
let response = try await client.askGemini(prompt: "Hello world")

// With file attachments
let imageData = Data(/* your image data */)
let fileAttachment = GeminiAskPostRequestFilesInner(
    fileName: "image.png", 
    data: imageData.base64EncodedString()
)
let request = GeminiAskPostRequest(
    prompt: "Analyze this image",
    files: [fileAttachment]
)
let response = try await client.geminiAskPost(geminiAskPostRequest: request)
```

## Development

### Prerequisites

- Node.js 18+
- Yarn 4.0+
- Swift 5.10+ (for client generation)

### Setup

```bash
# Enable Corepack for Yarn 4
corepack enable

# Install dependencies
yarn install

# Run unit tests (fast, use mocks)
yarn test

# Run end-to-end tests (manual only, requires real Gemini CLI)
yarn test:e2e

# Start development server
yarn dev

# Build for production
yarn build

# Generate Swift client
yarn generate:swift-client

# View server logs (last 20 lines)
yarn logs

# View custom number of log lines
LINES=50 yarn logs
```

### Project Structure

```
├── modules/
│   ├── server/          # Node.js API server
│   │   ├── test/e2e/    # End-to-end tests (manual execution)
│   │   └── src/         # Server source code
│   └── swift-client/    # Generated Swift client
├── .github/workflows/   # CI/CD workflows
├── docs/                # Project documentation
└── Package.swift        # Swift Package Manager manifest
```

### Testing

The project includes two types of tests:

#### Unit Tests (Automated)
```bash
# Run all unit tests with mocks
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests in watch mode
yarn vitest
```

Unit tests use mocks and run in CI/CD pipelines. They're fast and don't require external dependencies.

#### End-to-End Tests (Manual Only)

E2E tests verify real integration with the Gemini CLI but require manual execution:

**Prerequisites:**
1. Install Gemini CLI: `npm install -g @google/gemini-cli`
2. Configure authentication: `export GEMINI_API_KEY=your_key_here`

**Running E2E Tests:**
```bash
# Run E2E tests once
yarn test:e2e

# Run E2E tests in watch mode
yarn test:e2e:watch
```

**Important:** E2E tests are automatically skipped in CI environments because they:
- Require real API access and authentication
- Make actual API calls that consume quota
- Are slower and less predictable than unit tests

For detailed E2E testing instructions, see [`modules/server/README.e2e.md`](modules/server/README.e2e.md).

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Gemini Integration
- `POST /gemini/ask` - Execute Gemini CLI commands with optional file attachments

#### Request Body
```json
{
  "prompt": "string (required)",
  "files": [
    {
      "fileName": "string (required)",
      "data": "string (required, base64 encoded)"
    }
  ] (optional)
}
```

#### Response
```json
{
  "output": "string",
  "exitCode": "number",
  "stderr": "string", // optional
  "error": "string"   // optional, present if execution failed
}
```

## Configuration

The server can be configured via command line arguments or environment variables:

- `--port, -p` or `PORT`: Server port (default: 3000)
- `--host, -h` or `HOST`: Server host (default: 127.0.0.1)
- `--max-concurrent` or `MAX_CONCURRENT_REQUESTS`: Max concurrent requests (default: 5)
- `--request-timeout` or `REQUEST_TIMEOUT`: Request timeout in ms (default: 30000)

## Debugging and Logs

The server includes comprehensive logging for debugging purposes:

- **Log Location**: `modules/server/logs/app.log`
- **Log Format**: Structured JSON logs with pretty-formatted console output in development
- **Log Content**: HTTP requests/responses, Gemini CLI interactions, server events, and errors

### Viewing Logs

```bash
# View last 20 lines (default)
yarn logs

# View custom number of lines
LINES=100 yarn logs

# Monitor logs in real-time
cd modules/server && tail -f logs/app.log | npx pino-pretty
```

## Security

⚠️ **Important**: This server is designed for trusted environments only. It is **not hardened for and must not be exposed to the public internet.**

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.