# Software Development Document: Local Action Server

**Version:** 5.6
**Date:** May 22, 2024
**Status:** Final

## 1. Overview and Project Philosophy

This document outlines the design for the **Local Action Server**, a lightweight, extensible server designed to run on a local machine or within a private CI network. Its purpose is to provide an API that triggers local command-line actions, acting as a bridge for E2E tests or other automated tools.

The server's design is guided by the following principles:

*   **Ephemeral Lifecycle:** It is intended to be started on-demand for a specific set of tasks and stopped afterward. It is not designed for 24/7 uptime.
*   **Trusted Environment:** It is built to run on a developer's machine or an isolated CI runner within a private network. It is **not hardened for and must not be exposed to the public internet.**
*   **Extensibility:** The architecture is designed to be a simple framework for adding new actions (endpoints) over time. The initial implementation for `gemini` serves as a template for future capabilities.

## 2. Core Requirements

*   **FR1:** A local web server providing a JSON API, executable via `npx` from a GitHub repository.
*   **FR2:** The initial API endpoint will be `POST /gemini/ask` to interact with the `gemini` CLI.
*   **FR3:** The server architecture must be modular to easily accommodate new endpoints for other local actions in the future.
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
1.  Create a new route file in `packages/server/src/routes/ffmpeg.ts`.
2.  Implement the route handler logic.
3.  Register the new route with the Fastify instance.
4.  Regenerate the Swift client to automatically include the new API method.

## 4. API Design
... (Content unchanged from previous version) ...

## 5. Security Model: Trusted Environment
... (Content unchanged from previous version) ...

## 6. Operational Considerations
... (Content unchanged from previous version) ...

## 7. Swift Client

The Swift client generation process and usage pattern remain a key feature.

*   **Module Name:** The generated Swift package will be named **`RemoteTestToolsClient`** for generic use.
*   **Configuration:** The client's `basePath` must be configured by the consumer.

### 7.1. Swift Client Generation Process

The generation of the Swift client will be fully automated and non-interactive, driven by a `yarn` script.

1.  **OpenAPI Spec Generation:** A dedicated script (`yarn server openapi:generate`) will start the Fastify app instance in memory, generate the `openapi.json` specification file, and exit without listening for requests.
2.  **Client Code Generation:** The `openapi-generator-cli` will be invoked via `npx` to read the `openapi.json` file and write the generated Swift source files to the `packages/swift-client` directory.

This entire process will be encapsulated in a single command in the root `package.json`:

```json
"scripts": {
  "generate:swift-client": "yarn workspace server openapi:generate && npx @openapitools/openapi-generator-cli generate -i openapi.json -g swift5 -o packages/swift-client --additional-properties=projectName=RemoteTestToolsClient,responseAs=Async,swiftVersion=5.10"
}
```

### 7.2. Swift Package Manager (SPM) Consumption Strategy

To make the Swift client usable via SPM directly from the monorepo's Git URL, a proxy `Package.swift` file must be placed at the **root of the repository**. This file will point to the actual source code located in `packages/swift-client`. Swift Package Manager requires the manifest file to be at the root, and this "shim" approach satisfies that requirement while keeping the code organized in a subdirectory.

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
        .target(name: "RemoteTestToolsClient", path: "packages/swift-client/Sources/OpenAPIs")
    ]
)
```

## 8. Automated Testing Strategy
... (Content unchanged from previous version) ...

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