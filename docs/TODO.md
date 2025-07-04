# TODO: Remote Testing Tools Implementation Plan (Updated)

This document outlines the step-by-step plan to implement the remaining features for the Remote Testing Tools based on the requirements in `docs/spec.md` and the existing codebase.

---

## Phase 1: Server Foundation Hardening

- [ ] **1.1. Implement Orphaned Directory Cleanup:** On startup, perform a one-time cleanup of any leftover `/tmp/gemini-*` directories from previous crashed runs to prevent disk clutter.

---

## Phase 2: Automated Testing

- [ ] **2.1. Write Unit Tests (`packages/server/src/routes/__tests__/gemini.test.ts`):**
    - [ ] Mock external dependencies (`execa`, `fs.mkdtemp`, `p-queue`) using `vi.mock`.
    - [ ] Test the `gemini` route handler logic in isolation.
    - [ ] Verify correct handling of valid requests.
    - [ ] Verify correct error handling for invalid input (e.g., missing prompt).
    - [ ] Verify correct error handling for `execa` failures (e.g., timeout, non-zero exit code).

- [ ] **2.2. Write Integration Tests (`packages/server/test/integration/gemini.test.ts`):**
    - [ ] Create a test helper to build and tear down an in-memory server for each test.
    - [ ] Use `supertest` to send real HTTP requests to the in-memory server.
    - [ ] Mock the `execa` call to prevent actual process execution and to assert that it's called with the correct arguments (including `--sandbox` and `cwd`).
    - [ ] Test the full request/response lifecycle for the `/gemini/ask` endpoint.
    - [ ] Verify HTTP status codes (200, 400, 500) and response bodies are correct.

---

## Phase 3: Finalization & Documentation

- [ ] **3.1. Final Review:**
    - [ ] Manually run through all user stories and requirements from the spec one last time.
    - [ ] Ensure the project is ready for its first tagged release.
