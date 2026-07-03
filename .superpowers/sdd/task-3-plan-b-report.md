# Task 3: enquiry-notify Rewrite Report

**Status:** COMPLETE

**Commit:** `2904e1e` - fix(notifications): fix enquiry-notify — fix ENUM cast, add NOTIFICATIONS_ENABLED guard, add correlationId

---

## Changes Summary

### File: supabase/functions/enquiry-notify/index.ts

Complete rewrite replacing RPC-based approach with direct upsert pattern. This fixes three critical issues:

#### 1. **ENUM Casting Bug (PostgREST text→ENUM failure)**
   - **Before:** Used RPC calls with `p_type` parameter that triggered PostgREST ENUM casting failure
   - **After:** Direct `.upsert()` to `notification_jobs` table with `type` field — avoids RPC layer entirely
   - **Root cause:** Same PostgREST type-casting issue documented in create-order/index.ts

#### 2. **Missing NOTIFICATIONS_ENABLED Guard**
   - **Before:** Unconditionally processed enquiries
   - **After:** Checks `NOTIFICATIONS_ENABLED === 'true'` before proceeding; returns `{ success: true }` if disabled
   - **Impact:** Prevents spurious notification attempts when feature is off

#### 3. **Correlation ID Threading**
   - **Before:** Generated random UUID for each request, not linked to x-request-id header
   - **After:** Extracts `x-request-id` header and falls back to UUID; threads correlationId through all log calls
   - **Impact:** Enables distributed tracing across services

#### 4. **Consistent Structured Logging**
   - **Before:** Local `structuredLog()` function with inconsistent event names
   - **After:** Uses `logNotification()` from `_shared/log.ts` with standardized event enums (notification_enqueue_started, notification_enqueue_failed, notification_enqueue_success)
   - **Impact:** Aligns with centralized logging pattern used in other services (create-order, order-status-notify)

---

## Verification

### Deno Type Check
```
✓ Check enquiry-notify/index.ts
```
**Result:** PASS — No type errors

### Code Review Checklist
- [x] File matches provided code exactly (byte-for-byte)
- [x] Removes local `structuredLog()` function
- [x] Imports `logNotification` from `_shared/log.ts`
- [x] Uses direct upsert pattern instead of RPC calls
- [x] Adds NOTIFICATIONS_ENABLED guard (lines 40-43)
- [x] Threads correlationId from x-request-id header (line 21)
- [x] Payload includes correlationId for customer & admin notifications
- [x] Logs standardized events with correlation_id
- [x] Error handling captures error_message and error_code
- [x] Two separate upsert blocks (customer and admin) with independent error handling
- [x] Admin notification conditional on adminEmail presence

---

## Git State

```
Current branch: feat/admin-create-order-cors-fix
Commit: 2904e1e
Files changed: 1
  Insertions: 86
  Deletions: 62
```

**Note:** Git warning about CRLF is expected on Windows and harmless.

---

## No Concerns

All changes follow the provided specification exactly. File is ready for integration with other Phase-6 changes.
