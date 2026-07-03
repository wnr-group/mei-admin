# Task 1: Worker Auth Bypass Fix — Report

## Status
**DONE**

## Summary
Fixed a critical authentication bypass in the notification-worker Edge Function where missing `x-worker-secret` headers bypassed all auth checks.

## Commits
- `842a014` — fix(notifications): close worker auth bypass — require x-worker-secret unconditionally

## Changes Made

### File: `supabase/functions/notification-worker/index.ts` (lines 35–47)

**Before (buggy logic):**
```typescript
const callerSecret = req.headers.get('x-worker-secret');
const workerSecret = Deno.env.get('WORKER_SECRET');

// If both secret and caller secret exist, verify they match
if (callerSecret && workerSecret && callerSecret !== workerSecret) {
  structuredLog({ event: 'auth_failed', reason: 'invalid_worker_secret' });
  return json({ error: 'UNAUTHORIZED' }, 401);
}
```

**Issue:** When `callerSecret` is null (header missing), the `&&` chain short-circuits and the entire check is skipped. Any unauthenticated POST request succeeds.

**After (fixed logic):**
```typescript
const callerSecret = req.headers.get('x-worker-secret');
const workerSecret = Deno.env.get('WORKER_SECRET');

if (!workerSecret) {
  structuredLog({ event: 'config_error', error: 'WORKER_SECRET not set' });
  return json({ error: 'SERVER_MISCONFIGURED' }, 500);
}

// Reject if header is missing or doesn't match: null !== 'secret' is true, so unauthenticated requests fail
if (callerSecret !== workerSecret) {
  structuredLog({ event: 'auth_failed', reason: 'invalid_worker_secret', has_header: callerSecret !== null });
  return json({ error: 'UNAUTHORIZED' }, 401);
}
```

**Why this fixes it:**
- Explicit check that `WORKER_SECRET` is configured (returns 500 if not)
- Direct equality check `callerSecret !== workerSecret` without short-circuit logic
- `null !== 'some-secret'` evaluates to `true`, causing unauthenticated requests to be rejected with 401
- Logging includes `has_header` flag to distinguish between missing header vs. wrong secret

### File: `supabase/functions/_shared/log.ts` (types)
Added missing type annotations to fix Deno type check errors:
- `buildLogLine(service: string, fields: Record<string, unknown>)`
- `logNotification(service: string, fields: Record<string, unknown>)`

## Type Check Results

Command:
```bash
cd supabase/functions && npx deno check notification-worker/index.ts
```

Output:
```
Check notification-worker/index.ts
```

**Result:** ✓ No type errors. Type check passed successfully.

## Self-Review Checklist
- ✓ Fix matches the brief exactly (lines 35–47 replaced as specified)
- ✓ New logic requires `WORKER_SECRET` to be configured
- ✓ Unauthenticated requests (missing header) are rejected with 401
- ✓ Missing header case (`null !== 'secret'`) properly evaluated
- ✓ Comment added explaining why null comparison works
- ✓ Type check passes with no errors
- ✓ Commit message matches task requirement

## Concerns
None. The fix is straightforward and directly addresses the auth bypass vulnerability.
