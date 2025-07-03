# Remote Testing Tools

A lightweight, extensible server designed to run on a local machine or within a private CI network. Its purpose is to provide an API that triggers local command-line actions, acting as a bridge for E2E tests or other automated tools.

## Features

- **Ephemeral Lifecycle**: Designed to be started on-demand for specific tasks
- **Trusted Environment**: Built for developer machines or isolated CI runners
- **Extensible Architecture**: Simple framework for adding new actions over time
- **TypeScript & Fastify**: Modern, fast, and type-safe implementation
- **Swift Client**: Auto-generated Swift Package Manager compatible client

## Quick Start

### Running the Server

```bash
# Via npx (recommended)
npx github:yourusername/remote-testing-tools

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
curl -X POST http://localhost:3000/gemini/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the capital of France?"}'
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
let response = try await client.askGemini(prompt: "Hello world")
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

# Run tests
yarn test

# Start development server
yarn dev

# Build for production
yarn build

# Generate Swift client
yarn generate:swift-client
```

### Project Structure

```
├── packages/
│   ├── server/          # Node.js API server
│   └── swift-client/    # Generated Swift client
├── .github/workflows/   # CI/CD workflows
└── Package.swift        # Swift Package Manager manifest
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Gemini Integration
- `POST /gemini/ask` - Execute Gemini CLI commands

## Configuration

The server can be configured via command line arguments or environment variables:

- `--port, -p` or `PORT`: Server port (default: 3000)
- `--host, -h` or `HOST`: Server host (default: 127.0.0.1)
- `--max-concurrent` or `MAX_CONCURRENT_REQUESTS`: Max concurrent requests (default: 5)
- `--request-timeout` or `REQUEST_TIMEOUT`: Request timeout in ms (default: 30000)

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