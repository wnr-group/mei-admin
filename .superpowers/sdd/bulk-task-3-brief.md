# Task 3 Brief: Shared utilities — retry/backoff and error classification

## Overview

Create three utility modules for production-grade error handling, retry logic with exponential backoff, and centralized constants. These are consumed by Task 4's `services/product-import.ts`.

## Exact Requirements (from Plan Section: Task 3)

### Files to create:
- **Create:** `lib/retry.ts`
- **Create:** `__tests__/lib/retry.test.ts`
- **Create:** `lib/import-errors.ts`
- **Create:** `__tests__/lib/import-errors.test.ts`
- **Create:** `lib/product-import-constants.ts`

### Interfaces produced:
- `withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`
- `withRetryableQuery<T extends {data:unknown; error:{code?:string;message:string}|null}>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`
- `isRetryableError(err: unknown): boolean`
- `RetryOptions { maxAttempts?: number; baseDelayMs?: number; isRetryable?: (err: unknown) => boolean }`
- `ImportErrorCode` union
- `ImportStageError` class (`.code: ImportErrorCode`)
- `classifyError(err: unknown): ImportErrorCode`
- Constants: `MAX_SLUG_CODE_ATTEMPTS`, `MAX_IMPORT_PRODUCTS`, `PRODUCT_INSERT_CHUNK_SIZE`

### Key behavior:
- **Transient errors:** Postgres codes (40001, 40P01, 55P03), network messages (fetch failed, network, timeout, econnreset, econnrefused, 429)
- **Non-transient:** unique-constraint (23505), RLS/permission, validation, unknown errors
- **AbortError:** specifically excluded from retries (not retryable even if message looks network-related)
- **Exponential backoff:** `baseDelayMs * 2^(attempt-1)`
- **Defaults:** maxAttempts=3, baseDelayMs=250ms

### Constants values:
- `MAX_SLUG_CODE_ATTEMPTS = 20` (matches acceptance criterion "collision retried up to 20 attempts")
- `MAX_IMPORT_PRODUCTS = 1000` (hard ceiling, rejected before any writes if exceeded)
- `PRODUCT_INSERT_CHUNK_SIZE = 200` (products per multi-row insert call)

### Test coverage (from plan):
1. `withRetry`: happy path, retryable error + eventual success, non-retryable immediate rethrow, max attempts exhaustion, network error messages, AbortError not retried
2. `withRetryableQuery`: success unchanged, non-retryable error returned unchanged (no throw), retryable error result retried, persistent transient error exhausts and returns error result
3. `classifyError`: unique violation by code/message, RLS denial, network/timeout, unrecognized → DATABASE_ERROR, null → UNKNOWN_ERROR, ImportStageError returns its code directly
4. `ImportStageError`: carries code + message, is an Error instance

## Report File
Report to: `.superpowers/sdd/bulk-task-3-report.md`
