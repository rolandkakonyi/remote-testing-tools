# Software Development Document: Remote Testing Tools

**Version:** 5.8
**Date:** July 4, 2025
**Status:** In Progress

## 1. Overview and Project Philosophy

This document outlines the design for the **Remote Testing Tools**, a lightweight, extensible server designed to run on a local machine or within a private CI network. Its purpose is to provide an API that triggers local command-line actions, acting as a bridge for E2E tests or other automated tools.

The server's design is guided by the following principles:

*   **Ephemeral Lifecycle:** It is intended to be started on-demand for a specific set of tasks and stopped afterward. It is not designed for 24/7 uptime.
*   **Trusted Environment:** It is built to run on a developer's machine or an isolated CI runner within a private network. It is **not hardened for and must not be exposed to the public internet.**
*   **Extensibility:** The architecture is designed to be a simple framework for adding new actions (endpoints) over time. The initial implementation for `gemini` serves as a template for future capabilities.

## 2. Core Requirements

*   **FR1:** A local web server providing a JSON API, executable via `npx` from a GitHub repository.
*   **FR2:** The initial API endpoint will be `POST /gemini/ask` to interact with the `gemini` CLI.
*   **FR3:** The server architecture must be modular to easily accommodate new endpoints for other local actions in the future.
*   **FR4 (v5.8):** The `/gemini/ask` endpoint must support file attachments to be used as context for the prompt.
*   **NFR1:** Tech Stack: TypeScript and Yarn.
*   **NFR2:** A generatable Swift 5.10+ client package must be provided, consumable via Swift Package Manager (SPM).
*   **NFR3:** The project must have a comprehensive automated testing strategy.

## 3. Architectural Design

### 3.1. Technology Stack
*   **Runtime:** Node.js (LTS)
*   **Web Framework:** Fastify
*   **Process Execution:** `execa`
*   **Concurrency:** `p-queue`
*   **Configuration:** `dotenv` and Node.js `util.parseArgs`
*   **API Client Generation:** **`@openapitools/openapi-generator-cli`**. This will be included as a `devDependency` in `package.json` and executed via `npx` to avoid reliance on global installations.

### 3.2. Testing & Validation Tools

To ensure code quality and reliability, the project will use a specific set of tools for its automated tests.

| Tool      | Role                                        | Justification                                                                                                                                                                                             |
| :-------- | :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vitest**  | **Primary Testing Framework**               | **Chosen as the core test runner, assertion library, and mocking framework for both unit and integration tests.** It offers superior performance, first-class TypeScript support, and a Jest-compatible API. |
| **Supertest** | **HTTP Assertion Library (for Integration)** | **Used to make requests against the in-memory Fastify server during integration tests.** It provides a clean, chainable API for validating HTTP endpoints, status codes, and response bodies.             |

### 3.3. Extensibility
The server is designed to be a framework for actions. Adding a new action (e.g., `run-ffmpeg`) will follow a simple pattern:
1.  Create a new route file in `modules/server/src/routes/ffmpeg.ts`.
2.  Implement the route handler logic.
3.  Register the new route with the Fastify instance.
4.  Regenerate the Swift client to automatically include the new API method.

## 4. API Design

### 4.1. File Attachment Handling (v5.8)

To allow users to provide files as context for their prompts (e.g., asking questions about an image), the API supports file attachments.

*   **Transfer Method:** Files are sent within the JSON payload. Each file is an object containing its name and its data encoded as a **Base64 string**.
*   **Server-Side Handling:**
    1.  The server receives the request and decodes the Base64 data for each file.
    2.  Each file is written to the per-request isolated temporary directory.
    3.  The user's prompt is automatically prepended with a message listing the attached files (e.g., `Here are the user provided files for context: @image.png @data.csv`).
*   **Rationale:** This approach avoids the complexity of `multipart/form-data` and keeps the API contract as a single `application/json` endpoint, simplifying both the server implementation and client generation. The overhead of Base64 encoding is acceptable for the intended use case of providing context files to a CLI tool.

### 4.2. Security Enhancements (v5.7)

The Gemini CLI execution has been enhanced with two key security improvements:

1. **Sandbox Execution**: All Gemini CLI commands now run with the `--sandbox` flag for additional isolation and security.
2. **Isolated Temporary Directories**: Each request creates its own temporary directory using `mkdtemp()`, ensuring complete isolation between concurrent requests.

### 4.3. Gemini API Endpoint

**POST /gemini/ask**

This endpoint executes a Gemini CLI command with the provided prompt. All Gemini CLI arguments are controlled by the server implementation for security.

**Request Body:**
```json
{
  "prompt": "string (required)",
  "files": [
    {
      "fileName": "string (required)",
      "data": "string (required, base64 encoded)"
    }
  ]
}
```

**Response:**
```json
{
  "output": "string",
  "exitCode": "number", 
  "stderr": "string", // optional
  "error": "string" // optional, present if execution failed
}
```

**Security Features:**
- Automatic `--sandbox` flag inclusion for enhanced isolation
- Temporary directory creation (`/tmp/gemini-*`) with automatic cleanup
- Request timeout of 30 seconds
- Proper error handling with cleanup on failure

**Error Responses:**
- `400`: Invalid request (missing or empty prompt)
- `500`: Server error during execution

## 5. Security Model: Trusted Environment

### 5.1. Core Security Principles

This server is designed for **trusted environments only** and includes several security measures:

1. **Sandbox Execution**: All Gemini CLI commands run with the `--sandbox` flag for additional isolation
2. **Isolated Temporary Directories**: Each request executes in its own temporary directory with automatic cleanup
3. **Request Timeouts**: 30-second execution timeout to prevent resource exhaustion
4. **Concurrent Request Limiting**: Configurable queue system to limit concurrent operations
5. **Local Binding**: Default binding to `127.0.0.1` (localhost only)

### 5.2. Security Limitations

**Important:** This server is not hardened for public internet exposure and should only be used in:
- Local development environments
- Private CI/CD networks
- Isolated testing environments

The server does not include authentication, authorization, or other security measures required for public deployment.

## 6. Operational Considerations

*   **Prerequisite Check:** On startup, the server will check that the `gemini` CLI is installed and executable (`gemini --version`). If not, it will fail to start with a clear error message.
*   **Orphaned Directory Cleanup:** On startup, the server will perform a one-time cleanup of any temporary directories left over from previous crashed runs to prevent disk clutter.

## 7. Swift Client

The Swift client generation process and usage pattern remain a key feature.

*   **Module Name:** The generated Swift package will be named **`RemoteTestToolsClient`** for generic use.
*   **Configuration:** The client's `basePath` must be configured by the consumer.

### 7.1. Swift Client Generation Process

The generation of the Swift client will be fully automated and non-interactive, driven by a `yarn` script.

1.  **OpenAPI Spec Generation:** A dedicated script (`yarn server openapi:generate`) will start the Fastify app instance in memory, generate the `openapi.json` specification file, and exit without listening for requests.
2.  **Client Code Generation:** The `openapi-generator-cli` will be invoked via `npx` to read the `openapi.json` file and write the generated Swift source files to the `modules/swift-client` directory.

This entire process will be encapsulated in a single command in the root `package.json`:

```json
"scripts": {
  "generate:swift-client": "yarn workspace server openapi:generate && npx @openapitools/openapi-generator-cli generate -i modules/server/openapi.json -g swift5 -o modules/swift-client --additional-properties=projectName=RemoteTestToolsClient,responseAs=Async,swiftVersion=5.10"
}
```

### 7.2. Swift Package Manager (SPM) Consumption Strategy

To make the Swift client usable via SPM directly from the monorepo's Git URL, a proxy `Package.swift` file must be placed at the **root of the repository**. This file will point to the actual source code located in `modules/swift-client`. Swift Package Manager requires the manifest file to be at the root, and this "shim" approach satisfies that requirement while keeping the code organized in a subdirectory.

**Root `Package.swift` File:**

```swift
// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "LocalActionServer",
    platforms: [ .macOS(.v12), .iOS(.v15) ],
    products: [
        .library(name: "RemoteTestToolsClient", targets: ["RemoteTestToolsClient"]),
    ],
    targets: [
        .target(name: "RemoteTestToolsClient", path: "modules/swift-client/Sources/OpenAPIs")
    ]
)
```

## 8. Automated Testing Strategy

A multi-layered automated testing strategy is a core part of this project's development plan. The tools for this are specified in section 3.2.

### 8.1. Level 1: Unit Tests

*   **Scope:** These tests will focus on individual functions and route handlers in complete isolation. All external dependencies, such as the filesystem (`fs`) and process execution (`execa`), will be mocked using **Vitest's** built-in mocking capabilities.
*   **Location:** `modules/server/src/**/*.test.ts`

### 8.2. Level 2: Integration Tests

*   **Scope:** These tests will verify the interaction between different parts of the server. The server will be run in-memory, and **Supertest** will be used to make HTTP requests to it. `execa` will still be mocked by **Vitest**.
*   **Location:** `modules/server/test/integration/**/*.test.ts`

### 8.3. Level 3: Swift Client Build Verification

*   **Scope:** Instead of full end-to-end tests for the generated Swift client, a build verification step will be implemented. This ensures that the code generated by `openapi-generator-cli` is syntactically correct and compiles successfully as a Swift package.
*   **Rationale:** This decision provides a high degree of confidence at a much lower cost and complexity than a full E2E test suite. It guarantees that any changes to the server's API or the generator's configuration do not produce broken client code. The runtime behavior of the client will be validated by its consumers within their own E2E tests, which is the appropriate place for such validation.
*   **Workflow:**
    1.  The CI pipeline will generate the Swift client code into its package directory.
    2.  The pipeline will then execute `swift build` within that directory.
    3.  A successful compilation (exit code 0) will pass this verification step.

## 9. Continuous Integration (CI) with GitHub Actions

To enforce the testing strategy and ensure consistent, high-quality code, the project will use GitHub Actions for its CI pipeline.

### 9.1. Main Validation Workflow (`validation.yml`)

This workflow is the primary, non-interactive gatekeeper for code quality. It will run on every `push` to any branch and on every `pull_request` targeting the `main` branch.

#### A. `lint` Job
A fast-running job for code style and formatting.
*   **OS:** `ubuntu-latest`
*   **Steps:** Install dependencies and run `yarn lint`.

#### B. `test` Job
A comprehensive job that runs the full test suite and build checks across multiple operating systems.
*   **Strategy Matrix:** This job will run on both `ubuntu-latest` and `macos-latest`.
*   **Steps:**
    1.  **Checkout & Setup:** Check out the repo and set up Node.js.
    2.  **Install Dependencies:** Run `yarn install --immutable`. This will install `@openapitools/openapi-generator-cli` as a local dependency.
    3.  **Run Core Tests:** Execute unit and integration tests using `yarn test`.
    4.  **Build Server:** Compile the TypeScript code using `yarn build`.
    5.  **Setup Swift Environment (`if: runner.os == 'macOS'`):** Install Swift.
    6.  **Generate Swift Client (`if: runner.os == 'macOS'`):** Run `yarn generate:swift-client`. The `npx` command will use the locally installed generator CLI.
    7.  **Verify Swift Client Build (`if: runner.os == 'macOS'`):** Run `swift build` on the root `Package.swift` to ensure it compiles without errors.

### 9.2. Release Workflow (`release.yml`)

This workflow automates the process of creating a versioned release. It is triggered automatically when a version tag is pushed to ensure releases are based on explicit version tagging.

*   **Trigger:** `push` on tags matching `v*` pattern (e.g., `v1.2.3`).
*   **Version Extraction:** The workflow extracts the version number from the pushed tag name.
*   **Permissions:** This workflow will require `contents: write` permissions.
*   **Job: `create-release`**
    *   **Steps:** Run tests, build the project, extract version from tag, and create a formal GitHub Release with auto-generated notes.

### 9.3. Example Workflow File (`.github/workflows/validation.yml`)

```yaml
name: Validation

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --immutable

      - name: Run linter
        run: yarn lint

  test:
    name: Test (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --immutable

      - name: Run unit and integration tests
        run: yarn test

      - name: Build server
        run: yarn build

      - name: Set up Swift
        if: runner.os == 'macOS'
        uses: swift-actions/setup-swift@v2
        with:
          swift-version: "5.10"
      
      - name: Generate Swift Client
        if: runner.os == 'macOS'
        run: yarn generate:swift-client

      - name: Verify Swift Client Build
        if: runner.os == 'macOS'
        run: swift build
```