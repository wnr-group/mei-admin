# Task 3 Report: Shared utilities — retry/backoff and error classification

## Status: DONE

## What was built

- `lib/retry.ts`
  - `RetryOptions` interface (`maxAttempts`, `baseDelayMs`, `isRetryable`)
  - `isRetryableError(err)` — true for Postgres codes `40001`/`40P01`/`55P03` and
    network-ish messages (`fetch failed`, `network`, `timeout`, `econnreset`,
    `econnrefused`, `429`/`too many requests`); `AbortError` is checked first and
    always returns `false`, even if the message looks network-related.
  - `withRetry(fn, options?)` — retries on `isRetryableError` (or a caller-supplied
    predicate) with exponential backoff `baseDelayMs * 2^(attempt-1)`; rethrows
    immediately on non-retryable errors or once `maxAttempts` is exhausted.
  - `withRetryableQuery(fn, options?)` — same retry/backoff semantics for
    Supabase-style `{ data, error }` results; non-retryable error results are
    returned (not thrown), retryable ones are retried, and the final result is
    returned once attempts run out.
  - Defaults: `maxAttempts=3`, `baseDelayMs=250`.

- `lib/import-errors.ts`
  - `ImportErrorCode` union: `CATEGORY_NOT_FOUND`, `SLUG_COLLISION`,
    `PRODUCT_CODE_COLLISION`, `PRODUCT_INSERT_FAILED`, `COLOR_INSERT_FAILED`,
    `MEDIA_INSERT_FAILED`, `NETWORK_TIMEOUT`, `DATABASE_ERROR`,
    `UNIQUE_CONSTRAINT`, `VALIDATION_FAILED`, `RLS_DENIED`, `UNKNOWN_ERROR`.
  - `ImportStageError` — `Error` subclass carrying `.code: ImportErrorCode` and
    optional `.details`.
  - `classifyError(err)` — returns the code directly for `ImportStageError`;
    otherwise inspects Postgres `code`/message for unique-violation, RLS/permission,
    network/timeout, validation; unrecognized errors map to `DATABASE_ERROR`;
    `null`/`undefined` maps to `UNKNOWN_ERROR`.

- `lib/product-import-constants.ts`
  - `MAX_SLUG_CODE_ATTEMPTS = 20`
  - `MAX_IMPORT_PRODUCTS = 1000`
  - `PRODUCT_INSERT_CHUNK_SIZE = 200`

## TDD flow followed

1. Wrote `__tests__/lib/retry.test.ts` (10 cases) and
   `__tests__/lib/import-errors.test.ts` (8 cases) first.
2. Confirmed both suites failed with "Failed to resolve import" before the
   implementation files existed.
3. Implemented `lib/retry.ts`, `lib/import-errors.ts`; reran — all 18 passed.
4. Added `lib/product-import-constants.ts` (no tests needed, per brief).
5. Ran full suite and `tsc --noEmit`.

## Verification

- `npx vitest run __tests__/lib/retry.test.ts __tests__/lib/import-errors.test.ts`
  → 18/18 passed.
- `npx vitest run` (full suite) → 340 passed, 5 failed, all 5 pre-existing
  failures in `tests/database/schema-verification.test.ts` ("Invalid API key" —
  live Supabase credential/network issue, unrelated to this task). Confirmed via
  `git stash` that these same 5 tests fail identically on the pre-task commit
  (`b69dde2`), so there is no regression from this change.
- `npx tsc --noEmit` → no errors.

## Report

```
Status: DONE
Commits: f0e80b3
Tests: 18 new tests passed (10 retry.ts + 8 import-errors.ts); full suite 340 passed / 5 pre-existing failures (unrelated Supabase credential issue in tests/database/schema-verification.test.ts, verified pre-existing via git stash)
```
