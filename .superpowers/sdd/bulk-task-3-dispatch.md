# Task 3 Dispatcher (Ready to send once Tasks 1-2 approved)

## Task: Create shared production-grade utilities (retry, backoff, error classification)

Brief file: `.superpowers/sdd/bulk-task-3-brief.md`
Report file: `.superpowers/sdd/bulk-task-3-report.md`

## Implementation sequence:

1. Create `__tests__/lib/retry.test.ts` with failing tests (10 test cases)
2. Run: `npx vitest run __tests__/lib/retry.test.ts` → verify fails
3. Create `lib/retry.ts` with exact implementation (withRetry, withRetryableQuery, isRetryableError, RetryOptions)
4. Run tests → verify all 10 pass
5. Create `__tests__/lib/import-errors.test.ts` with failing tests (8 test cases)
6. Run: `npx vitest run __tests__/lib/import-errors.test.ts` → verify fails
7. Create `lib/import-errors.ts` with exact implementation (ImportStageError, classifyError, ImportErrorCode)
8. Run tests → verify all 8 pass
9. Create `lib/product-import-constants.ts` (constants only, no tests needed)
10. Run: `npx vitest run` → verify all 18 new tests pass
11. Run: `npx tsc --noEmit` → verify no type errors
12. Commit: "Add retry/backoff and error-classification utilities for bulk import (MEI-43)"

## Key constants to include:
- MAX_SLUG_CODE_ATTEMPTS = 20
- MAX_IMPORT_PRODUCTS = 1000
- PRODUCT_INSERT_CHUNK_SIZE = 200

## Key behaviors:
- Transient errors: Postgres 40001/40P01/55P03, network messages
- Non-retryable: unique-constraint, RLS, validation, unknown
- AbortError: explicitly NOT retryable (excluded ahead of checks)
- Exponential backoff: baseDelayMs * 2^(attempt-1)
- Defaults: maxAttempts=3, baseDelayMs=250ms
