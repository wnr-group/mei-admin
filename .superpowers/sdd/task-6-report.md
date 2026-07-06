# Task 6 Report — Phase 6 Observability Logging

## Files Created/Modified

- [x] Created: supabase/functions/_shared/log.ts
- [x] Created: supabase/functions/_shared/log.test.ts (1 test, PASSED)
- [x] Modified: supabase/functions/notification-worker/index.ts (added provider_request_* events)
- [x] Modified: supabase/functions/create-order/index.ts (added notification_enqueue_* events)

## Test Results

```
deno test --allow-env supabase/functions/_shared/log.test.ts
--- output ---
Check supabase/functions/_shared/log.test.ts
running 1 test from ./supabase/functions/_shared/log.test.ts
buildLogLine always includes every required field, defaulting to null ... ok (1ms)

ok | 1 passed | 0 failed (10ms)
```

## Type Check Results

```
deno check --node-modules-dir=auto supabase/functions/notification-worker/index.ts
--- output ---
Check supabase/functions/notification-worker/index.ts
(exit 0 — no errors)

deno check --node-modules-dir=auto supabase/functions/create-order/index.ts
--- output ---
Check supabase/functions/create-order/index.ts
(exit 0 — no errors)
```

Note: `--node-modules-dir=auto` was required because the root package.json is present; without it deno cannot resolve jsr npm deps. PromiseLike<void> annotation used for `enqueueAdmin` (supabase chain returns PromiseLike, not Promise).

## Deployment

```
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
--- output ---
Bundling Function: notification-worker
Deploying Function: notification-worker (script size: 676 kB)
{"project_ref":"hjhqemsyufsifmgespur","functions":["notification-worker"],"dashboard_url":"https://supabase.com/dashboard/project/hjhqemsyufsifmgespur/functions","message":"Deployed Functions."}

supabase functions deploy create-order --project-ref hjhqemsyufsifmgespur
--- output ---
Bundling Function: create-order
Deploying Function: create-order (script size: 671 kB)
{"project_ref":"hjhqemsyufsifmgespur","functions":["create-order"],"dashboard_url":"https://supabase.com/dashboard/project/hjhqemsyufsifmgespur/functions","message":"Deployed Functions."}
```

## Verification

Sample log line structure (from worker on provider_request_success):
```json
{
  "service": "notification-worker",
  "environment": "production",
  "ts": "2026-07-02T11:30:00.000Z",
  "order_id": "123",
  "order_number": "ORD-001",
  "customer_id": null,
  "customer_email": "customer@example.com",
  "customer_phone": null,
  "notification_type": "ORDER_CONFIRMATION_CUSTOMER",
  "provider": "mailgun",
  "provider_message_id": "20260702...@mg.example.com",
  "error_code": null,
  "error_message": null,
  "correlation_id": "req-uuid-from-create-order",
  "event": "provider_request_success"
}
```

All 6 event types are wired:
- create-order emits: notification_enqueue_started, notification_enqueue_success, notification_enqueue_failed (per notification type: CUSTOMER + ADMIN)
- notification-worker emits: provider_request_started, provider_request_success, provider_request_failed

Correlation ID flows: create-order sets `correlationId: requestId` in the job payload; worker reads `job.payload?.correlationId` and falls back to `job.id`.

## Commit

commit: 25b1256 feat(notifications): add Phase-6 structured logging with correlation ids
