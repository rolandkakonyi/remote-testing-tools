# End-to-End Testing Guide

This document explains how to run the End-to-End (E2E) tests for the Remote Testing Tools server.

## Overview

The E2E tests verify the complete integration between the server and the actual Gemini CLI. Unlike unit tests that use mocks, these tests make real API calls to Google's Gemini service.

## Prerequisites

### 1. Gemini CLI Installation

The E2E tests require the actual Gemini CLI to be installed and available in your PATH.

```bash
# Install the Gemini CLI
npm install -g @google/gemini-cli

# Verify installation
gemini --version
```

### 2. Authentication Setup

You need to configure authentication for the Gemini CLI. The server will use the same authentication as your host machine.

```bash
# Set your Gemini API key
export GEMINI_API_KEY=your_api_key_here

# Or configure using the Gemini CLI auth setup
gemini auth setup
```

### 3. Dependencies

Ensure all project dependencies are installed:

```bash
yarn install
```

## Running E2E Tests

### Manual Execution Only

**Important**: E2E tests are designed for manual execution only and are explicitly excluded from CI/CD pipelines because they:

1. Require real Gemini API access
2. Make actual API calls that consume quota
3. May be slower and less predictable than unit tests
4. Require authentication setup

### Run E2E Tests

```bash
# Run all E2E tests
yarn test:e2e

# Run E2E tests in watch mode (for development)
yarn test:e2e:watch
```

### Test Configuration

The E2E tests use a separate Vitest configuration (`vitest.e2e.config.ts`) with:

- Longer timeouts (2 minutes) for real API calls
- Single-threaded execution to avoid overwhelming the API
- Automatic skipping in CI environments

## Test Categories

### 1. Basic Integration Tests

- Simple text prompts
- Error handling

### 2. File Attachment Tests

- Image file attachments (PNG)
- Text file attachments
- Multiple file attachments
- Binary file handling

### 3. Performance Tests

- Concurrent request handling
- Large file processing
- Timeout scenarios

### 4. Error Handling Tests

- Authentication failures
- Network timeouts

## Test Structure

```
test/e2e/
└── gemini.e2e.test.ts    # Main E2E test suite
```

Each test:

1. Starts a real server instance
2. Makes HTTP requests to the server
3. Verifies the server correctly calls Gemini CLI
4. Checks the complete request/response cycle

## CI/CD Behavior

E2E tests are automatically skipped when:

- `process.env.CI` is set (CI environment)
- `process.env.GITHUB_ACTIONS` is set (GitHub Actions)
- Gemini CLI is not available in PATH

This ensures CI pipelines run only unit tests with mocks.

## Troubleshooting

### Common Issues

1. **"Gemini CLI not available"**
   - Install the Gemini CLI: `npm install -g @google/gemini-cli`
   - Check PATH: `which gemini`

2. **Authentication errors**
   - Verify API key: `echo $GEMINI_API_KEY`
   - Check Gemini CLI auth: `gemini auth status`

3. **Timeout errors**
   - Check internet connectivity
   - Verify API quota and limits
   - Try a simpler prompt first

4. **Permission errors**
   - Ensure proper file permissions for temp directories
   - Check sandbox execution permissions

### Debug Mode

Enable debug logging for more verbose output:

```bash
DEBUG=* yarn test:e2e
```

### Isolated Testing

To test a specific scenario:

```bash
# Test only file attachment functionality
yarn test:e2e --grep "file attachment"

# Test only error handling
yarn test:e2e --grep "error"
```

## Best Practices

1. **Run E2E tests before releases** to ensure real-world functionality
2. **Monitor API usage** as E2E tests consume Gemini API quota
3. **Keep test prompts simple** to ensure consistent results
4. **Use specific response patterns** in prompts for reliable assertions
5. **Test in different environments** (development, staging) before production

## Example Usage

Here's how to verify the server works end-to-end:

```bash
# 1. Start the server
yarn dev

# 2. In another terminal, test manually
curl -X POST http://localhost:3000/gemini/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say hello"}'

# 3. Run automated E2E tests
yarn test:e2e
```

## Integration with Development Workflow

1. **During development**: Use unit tests for rapid feedback
2. **Before commits**: Run both unit and E2E tests
3. **In CI**: Only unit tests run automatically
4. **Before releases**: Manually run E2E tests to verify real-world functionality

This approach ensures fast development cycles while maintaining confidence in real-world functionality.