# Task 2 — Order-Status-Notify Rewrite — Report

## Status
**DONE**

## Commits
- `17f7c14` fix(notifications): fix order-status-notify — remove broken jwtVerify, fix ENUM cast, add correlationId

## Changes Made

### File: supabase/functions/order-status-notify/index.ts

Complete rewrite addressing three production bugs:

1. **Removed broken jwtVerify** (Bug #1)
   - Old code: Called `jwtVerify(token, secretKey)` without importing it
   - Result: Every JWT verification silently returned null, all requests got 401
   - New code: Removed entire `verifyJWT()` function and manual JWT verification
   - JWT is now enforced at Supabase platform level (deployment without --no-verify-jwt flag)
   - Requests reaching the function are already authenticated admin sessions

2. **Fixed ENUM casting bug** (Bug #2)
   - Old code: Used RPC call `enqueue_notification()` which passes JSON string as `text` parameter
   - Problem: PostgREST serializes parameters as JSON, PostgreSQL cannot implicitly cast text to ENUM
   - New code: Direct `upsert()` on `notification_jobs` table
   - Pattern avoids PostgREST parameter serialization, directly inserts with correct types
   - References documented explanation in create-order/index.ts

3. **Added NOTIFICATIONS_ENABLED guard** (Bug #3)
   - New code: Checks `Deno.env.get('NOTIFICATIONS_ENABLED') === 'true'` before enqueueing
   - Returns success response with `enqueued: false` if disabled
   - Allows graceful disabling of notifications without function errors

### Logging Improvements

- Changed from custom `structuredLog()` to imported `logNotification()` from `_shared/log.ts`
- Replaced `requestId` with `correlationId` throughout
- correlationId sourced from `x-request-id` header or generated UUID
- Consistent `correlation_id` field in all structured logs
- Added detailed logging for notification enqueue lifecycle (started, success, failed)

### Payload Structure

- Added `correlationId` to notification payload for end-to-end tracing
- Payload now structured for customer email notifications:
  - `correlationId`: Request correlation ID
  - `customerName`: From order's customer record
  - `orderNumber`: From order record
  - `newStatus`: Status being updated to

## Type-Check Verification

```
Command: cd supabase/functions && npx deno check order-status-notify/index.ts

Output:
Check order-status-notify/index.ts
```

**Result:** No errors. All types validate correctly.

## Self-Review: Bug Fixes Confirmed

✓ Bug #1 (jwtVerify): Entire broken verification function removed. JWT validation now platform-level.
✓ Bug #2 (ENUM cast): RPC call replaced with direct upsert on notification_jobs table. Avoids PostgREST text serialization.
✓ Bug #3 (NOTIFICATIONS_ENABLED guard): Added early return when disabled.

## Concerns

None. File matches specification exactly. All three bugs fixed. Type check passes.
