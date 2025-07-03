# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript monorepo containing a local action server and Swift client. The server provides a REST API for triggering local command-line actions (currently focused on Gemini CLI integration) and is designed to run in trusted environments only.

## Architecture

- **Yarn 4 Workspaces**: Root manages two packages via workspaces
- **packages/server/**: Node.js TypeScript server using Fastify
- **packages/swift-client/**: Auto-generated Swift Package Manager client
- **Root Package.swift**: Proxy manifest for SPM consumption from Git URL

## Key Commands

### Development
```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build all packages
yarn build

# Run tests across all workspaces
yarn test

# Run linting across all workspaces
yarn lint
```

### Server-specific (from packages/server/)
```bash
# Run server tests with Vitest (non-interactive)
yarn test

# Run server with coverage
yarn test:coverage

# Run tests in watch mode (interactive)
yarn vitest

# Lint server code
yarn lint

# Generate OpenAPI spec
yarn openapi:generate
```

### Swift Client Generation

**Automatic Sync**: The Swift client is automatically regenerated when server API files change via pre-commit hooks.

```bash
# Generate Swift client from OpenAPI spec (manual)
yarn generate:swift-client

# Validate Swift client is up-to-date
yarn validate:swift-client
```

#### How it works:
1. **Pre-commit Hook**: When you commit changes to `packages/server/src/`, the Swift client is automatically regenerated and staged
2. **CI Validation**: GitHub Actions verifies the Swift client is up-to-date and fails if not
3. **Manual Generation**: You can still run `yarn generate:swift-client` manually when needed

#### Process:
1. Generates OpenAPI spec from server using Fastify's swagger plugin
2. Uses `@openapitools/openapi-generator-cli` to create Swift 5.10 client
3. Outputs to `packages/swift-client/Sources/OpenAPIs/`

#### If CI fails with "Swift client out of sync":
```bash
yarn generate:swift-client
git add packages/swift-client/ packages/server/openapi.json
git commit --amend --no-edit
```

## Technology Stack

- **Server**: Node.js 18+, TypeScript, Fastify, Vitest
- **Process Execution**: `execa` for running CLI commands
- **Concurrency**: `p-queue` for request management
- **Client Generation**: OpenAPI Generator for Swift client
- **Testing**: Vitest for unit/integration tests, Supertest for HTTP assertions

## Development Notes

- Server is ephemeral - designed for on-demand execution, not 24/7 uptime
- Trusted environment only - NOT hardened for public internet exposure
- Extensible architecture - new endpoints follow the pattern in `routes/gemini.ts`
- Swift client auto-generates from OpenAPI spec - don't edit manually
- Uses `tsx` for TypeScript execution in development

## Configuration

Server accepts CLI args or environment variables:
- `--port, -p` or `PORT`: Server port (default: 3000)
- `--host, -h` or `HOST`: Server host (default: 127.0.0.1)  
- `--max-concurrent` or `MAX_CONCURRENT_REQUESTS`: Max concurrent requests (default: 5)
- `--request-timeout` or `REQUEST_TIMEOUT`: Request timeout in ms (default: 30000)