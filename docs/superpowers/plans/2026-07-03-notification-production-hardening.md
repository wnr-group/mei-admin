# Notification System Production Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the deployed notification system against six confirmed bugs and five operational gaps before production launch, without changing any working business flows.

**Architecture:** Additive fixes and new endpoints only. All changes are in `supabase/functions/` (Edge Functions), `app/(app)/enquiries/[id]/page.tsx` (UI bug), and a new SQL migration. No schema changes, no new tables, no architectural changes.

**Tech Stack:** Deno Edge Functions (TypeScript), Supabase JS v2, PostgreSQL 17, pg_cron, pg_net, Next.js 16

## Global Constraints

- Do NOT touch checkout, payment, order creation, or storefront UI
- Do NOT add new dependencies or providers
- Do NOT modify `supabase/migrations/20260701_notification_queue.sql` — append a new migration instead
- Existing behavior that works must continue to work after each task
- Every deployment must include rollback instructions that restore the prior state
- Do not deploy `supabase/functions/test-expedite-retry/` to production under any circumstance
- Run `npx tsc --noEmit` after every TypeScript change and fix any errors before committing

---

## Audit Findings

### CRITICAL — Must fix before production

| ID | Finding | File | Evidence |
|---|---|---|---|
| C-1 | `jwtVerify` called but never imported — every `order-status-notify` call returns 401 | `order-status-notify/index.ts:43` | No import statement for `jwtVerify`; `try/catch` at :45 swallows ReferenceError; caller in `services/orders.ts:68` always gets 401 |
| C-2 | `enqueue_notification` RPC passes ENUM as text — PostgREST cannot cast text→notification_type during function overload resolution | `order-status-notify/index.ts:154` | Same documented bug in `create-order/index.ts:219–223`: "PostgREST passes JSON strings as text, which PostgreSQL cannot implicitly cast to a user-defined ENUM for function argument resolution" |
| C-3 | Same ENUM casting bug in `enquiry-notify` — notifications silently fail, function returns `success: true` | `enquiry-notify/index.ts:71,108` | Same RPC pattern; errors are only logged, not propagated to caller |
| C-4 | Worker auth check short-circuits when `x-worker-secret` header is absent — any unauthenticated POST triggers the queue | `notification-worker/index.ts:39` | `if (callerSecret && workerSecret && ...)` — `null &&` is false, entire check skipped; JWT verification must be disabled (pg_cron calls without JWT, yet worker runs — confirmed in progress.md Task 1) |
| C-5 | Enquiry WhatsApp button shows hardcoded fallback number when `enquiry.phone` is null | `app/(app)/enquiries/[id]/page.tsx:139` | `const finalPhone = enquiry.phone \|\| '+91 98765 43210'` — compare correct pattern on orders page (:188): `{order.customers?.phone && <a ...>}` |
| C-6 | `test-expedite-retry` has no authentication and directly mutates `notification_jobs` | `supabase/functions/test-expedite-retry/index.ts` | No auth header check; raw `.update({ next_attempt_at: ... })`; currently untracked but must not be deployed |

### RELIABILITY — Recommended

| ID | Finding | File | Evidence |
|---|---|---|---|
| R-1 | `NOTIFICATIONS_ENABLED` guard is only in `create-order` — enquiry-notify and order-status-notify always enqueue | `create-order/index.ts:175` vs `enquiry-notify/index.ts` (no guard) | Setting `NOTIFICATIONS_ENABLED=false` to pause notifications stops order confirmations but not enquiry/status emails |
| R-2 | Dead letter jobs have no alerting — they accumulate silently | `20260701_notification_queue.sql:193` | progress.md Task 5: "3 DEAD jobs" in production; no automated alert; only discoverable via DB query |
| R-3 | No dead letter reset mechanism after fixing root cause | `20260701_notification_queue.sql` | Only `fail_notification_job`, `complete_notification_job`, `claim_notification_jobs` exist; after a Mailgun outage, DEAD jobs cannot be retried |

### OBSERVABILITY — Recommended

| ID | Finding | File | Evidence |
|---|---|---|---|
| O-1 | `notification_health` view exists in DB but has no HTTP endpoint | `20260701_notification_queue.sql:235–246` | View defined but no edge function exposes it; external monitors cannot check system health |
| O-2 | `enquiry-notify` and `order-status-notify` define local `structuredLog` — missing `environment` field, no shared format | `enquiry-notify/index.ts:16`, `order-status-notify/index.ts:18` | `_shared/log.ts:18` adds `environment: Deno.env.get('ENVIRONMENT')` and 10 standard fields; local functions omit these |
| O-3 | No `correlationId` passed from `enquiry-notify` or `order-status-notify` into job payload | `notification-worker/index.ts:79` | Worker reads `job.payload?.correlationId`; create-order threads it through (:185); enquiry-notify and order-status-notify do not — jobs from these sources are untraceable in logs |

### OPERATIONAL TOOLING — Recommended

| ID | Finding | File | Evidence |
|---|---|---|---|
| T-1 | No SQL function to reset DEAD jobs to PENDING | `20260701_notification_queue.sql` | After fixing a Mailgun config issue, dead jobs must be manually reset with raw UPDATE queries |
| T-2 | `notification_events` and old `notification_jobs` rows have no retention | `20260701_notification_queue.sql:66–78` | No DELETE or pg_cron cleanup; at typical volume (50 orders/day × 5 events), 90K+ rows accumulate annually |

### DEPLOYMENT SAFETY

| ID | Finding | Evidence |
|---|---|---|
| D-1 | `test-expedite-retry` is untracked and unauthenticated | `?? supabase/functions/test-expedite-retry/` in git status; no auth in index.ts |
| D-2 | Task 9 (Production Rollout + DoD) is still QUEUED | progress.md lines 165–169 |

---

## File Structure

```
supabase/functions/
  notification-worker/index.ts          MODIFY — fix auth bypass (C-4)
  order-status-notify/index.ts          MODIFY — remove broken jwtVerify, fix ENUM, add logging/correlationId (C-1, C-2, O-2, O-3)
  enquiry-notify/index.ts               MODIFY — fix ENUM, add guard, add logging/correlationId (C-3, R-1, O-2, O-3)
  notification-health/index.ts          CREATE — HTTP health endpoint (O-1)
  test-expedite-retry/                  ADD .production-ignore note (D-1)

app/(app)/enquiries/[id]/page.tsx       MODIFY — remove hardcoded phone fallback (C-5)

supabase/migrations/
  20260703_notification_hardening.sql   CREATE — dead letter reset, retention pg_cron jobs (R-2, R-3, T-1, T-2)
```

---

## Task 1: Fix notification-worker authentication bypass

**Severity:** Critical (C-4)

The current auth condition `if (callerSecret && workerSecret && callerSecret !== workerSecret)` is logically flawed: when `callerSecret` is `null` (no header sent), JavaScript short-circuits the `&&` chain and the rejection block never runs. pg_cron works because it sends the correct secret — but anyone knowing the worker URL can also trigger it by omitting the header entirely.

JWT verification is disabled at the platform level for this function (required so pg_cron can call it without a session token — confirmed working in production per progress.md Task 1). The x-worker-secret is the only protection layer, and it must be enforced unconditionally.

**Files:**
- Modify: `supabase/functions/notification-worker/index.ts:35–42`

**Interfaces:**
- Produces: Only requests with `x-worker-secret: <WORKER_SECRET>` are processed; all others receive 401

- [ ] **Step 1: Read the current auth block**

Lines 34–42 of `notification-worker/index.ts`:
```typescript
  // Note: verify_jwt is enabled on this function, so Supabase already validates JWT tokens.
  // If using custom x-worker-secret header from pg_cron, we'll accept it here too.
  const callerSecret = req.headers.get('x-worker-secret');
  const workerSecret = Deno.env.get('WORKER_SECRET');

  // If both secret and caller secret exist, verify they match
  if (callerSecret && workerSecret && callerSecret !== workerSecret) {
    structuredLog({ event: 'auth_failed', reason: 'invalid_worker_secret' });
    return json({ error: 'UNAUTHORIZED' }, 401);
  }
```

- [ ] **Step 2: Replace with strict auth**

Replace lines 34–42 exactly with:
```typescript
  const callerSecret = req.headers.get('x-worker-secret');
  const workerSecret = Deno.env.get('WORKER_SECRET');

  if (!workerSecret) {
    structuredLog({ event: 'config_error', error: 'WORKER_SECRET not set' });
    return json({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  if (callerSecret !== workerSecret) {
    structuredLog({ event: 'auth_failed', reason: 'invalid_worker_secret', has_header: callerSecret !== null });
    return json({ error: 'UNAUTHORIZED' }, 401);
  }
```

The key difference: `callerSecret !== workerSecret` is always evaluated — `null !== 'some-secret'` is `true`, so a request with no header is rejected.

- [ ] **Step 3: Type-check**

```bash
cd supabase/functions && npx deno check notification-worker/index.ts
```

Expected: no errors (no type changes were made)

- [ ] **Step 4: Deploy**

```bash
npx supabase functions deploy notification-worker --no-verify-jwt
```

Expected output: `Deployed Function notification-worker`

The `--no-verify-jwt` flag keeps JWT verification disabled at the platform level so pg_cron can call the function. The x-worker-secret is now the sole auth mechanism.

- [ ] **Step 5: Verify — legitimate call succeeds**

Wait for the next pg_cron tick (up to 2 minutes), then query:

```sql
SELECT status, COUNT(*) FROM notification_jobs GROUP BY status;
```

Expected: jobs continue to be processed (SENT count increases if any jobs are PENDING)

- [ ] **Step 6: Verify — unauthenticated call is rejected**

```bash
curl -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response: `{"error":"UNAUTHORIZED"}` with HTTP 401

- [ ] **Step 7: Rollback procedure**

If the deployment breaks pg_cron (e.g., WORKER_SECRET env var was not set), restore prior auth logic:

```bash
# Revert the file, then redeploy
git checkout supabase/functions/notification-worker/index.ts
npx supabase functions deploy notification-worker --no-verify-jwt
```

Then verify pg_cron resumes by checking `notification_jobs` for new SENT jobs within 5 minutes.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/notification-worker/index.ts
git commit -m "fix(notifications): close worker auth bypass — require x-worker-secret unconditionally"
```

---

## Task 2: Fix order-status-notify (three bugs)

**Severity:** Critical (C-1, C-2, O-2, O-3)

Three bugs in one function:
1. `jwtVerify` is never imported — `verifyJWT()` always returns null → 401 (C-1)
2. `enqueue_notification` RPC receives `p_type` as JSON string → PostgreSQL can't cast text→ENUM → enqueue silently fails (C-2)
3. Local `structuredLog` missing `environment` field + no `correlationId` in job payload (O-2, O-3)

The fix: remove custom JWT verification (Supabase platform validates JWT for this function since it's called via `supabase.functions.invoke()` from an authenticated admin session), replace RPC with direct table upsert (same pattern as `create-order`), import shared logger, add `correlationId`.

**Files:**
- Modify: `supabase/functions/order-status-notify/index.ts` (full file replacement)

**Interfaces:**
- Consumes: `{ order_id: string; new_status: string }` in POST body with valid Supabase session JWT in Authorization header
- Produces: `{ success: true, enqueued: boolean }` or error response; job row in `notification_jobs` with `correlationId` in payload

- [ ] **Step 1: Write the replacement file**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logNotification } from '../_shared/log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NOTIFY_STATUSES = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface NotifyRequest {
  order_id: string;
  new_status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  // JWT validation is enforced at the Supabase platform level — this function is deployed
  // without --no-verify-jwt, so only authenticated admin sessions reach this handler.

  const correlationId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  const log = (event: string, extra?: Record<string, unknown>) =>
    logNotification('order-status-notify', { event, correlation_id: correlationId, ...extra });

  log('order_status_notify_started');

  try {
    const body = (await req.json()) as NotifyRequest;
    log('request_parsed', { order_id: body.order_id, new_status: body.new_status });

    if (!body.order_id || !body.new_status) {
      log('invalid_payload');
      return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);
    }

    if (body.new_status === 'PENDING' || !NOTIFY_STATUSES.has(body.new_status)) {
      log('status_not_notifiable', { status: body.new_status });
      return json({ success: true, enqueued: false, detail: 'Status does not require notification' });
    }

    const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';
    if (!enabled) {
      log('notifications_disabled');
      return json({ success: true, enqueued: false, detail: 'Notifications disabled' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      log('missing_supabase_config');
      return json({ success: false, error: 'SERVER_MISCONFIGURED' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, status')
      .eq('id', body.order_id)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      log('order_not_found', { error: orderError?.message });
      return json({ success: false, error: 'ORDER_NOT_FOUND' }, 404);
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', order.customer_id)
      .single();

    if (customerError || !customer) {
      log('customer_not_found', { error: customerError?.message });
      return json({ success: false, error: 'CUSTOMER_NOT_FOUND' }, 404);
    }

    const idempotencyKey = `ORDER_STATUS_UPDATE_CUSTOMER:${body.order_id}:${body.new_status}`;
    const payload_data = {
      correlationId,
      customerName: customer.name,
      orderNumber: order.order_number,
      newStatus: body.new_status,
    };

    logNotification('order-status-notify', {
      event: 'notification_enqueue_started',
      correlation_id: correlationId,
      notification_type: 'ORDER_STATUS_UPDATE_CUSTOMER',
      customer_email: customer.email,
      order_id: body.order_id,
      order_number: order.order_number,
    });

    // Direct upsert — avoids PostgREST text→ENUM casting failure that affects RPC calls.
    // See create-order/index.ts for the documented explanation of this pattern.
    const { error: enqueueError } = await supabase
      .from('notification_jobs')
      .upsert(
        {
          idempotency_key: idempotencyKey,
          type: 'ORDER_STATUS_UPDATE_CUSTOMER',
          recipient_email: customer.email,
          payload: payload_data,
          priority: 1,
        },
        { onConflict: 'idempotency_key', ignoreDuplicates: true }
      );

    if (enqueueError) {
      logNotification('order-status-notify', {
        event: 'notification_enqueue_failed',
        correlation_id: correlationId,
        notification_type: 'ORDER_STATUS_UPDATE_CUSTOMER',
        customer_email: customer.email,
        error_message: enqueueError.message,
        error_code: enqueueError.code ?? null,
      });
      log('enqueue_failed', { error: enqueueError.message });
      return json({ success: true, enqueued: false, detail: enqueueError.message });
    }

    logNotification('order-status-notify', {
      event: 'notification_enqueue_success',
      correlation_id: correlationId,
      notification_type: 'ORDER_STATUS_UPDATE_CUSTOMER',
      customer_email: customer.email,
      order_id: body.order_id,
      order_number: order.order_number,
    });

    log('notification_enqueued');
    return json({ success: true, enqueued: true });
  } catch (err) {
    log('unhandled_error', { error: String(err) });
    return json({ success: false, error: 'INTERNAL_ERROR' }, 500);
  }
});
```

- [ ] **Step 2: Type-check**

```bash
cd supabase/functions && npx deno check order-status-notify/index.ts
```

Expected: no errors

- [ ] **Step 3: Deploy without `--no-verify-jwt`**

```bash
npx supabase functions deploy order-status-notify
```

Omitting `--no-verify-jwt` enables platform-level JWT validation — only authenticated admin sessions can invoke this function.

Expected output: `Deployed Function order-status-notify`

- [ ] **Step 4: Verify — update an order status in the admin UI**

Open any order in the admin panel. Change status to CONFIRMED. Then immediately query:

```sql
SELECT idempotency_key, type, status, recipient_email, created_at
FROM notification_jobs
WHERE type = 'ORDER_STATUS_UPDATE_CUSTOMER'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: A new row with `status = 'PENDING'` and `type = 'ORDER_STATUS_UPDATE_CUSTOMER'`.

Then wait up to 2 minutes for the worker to process it:

```sql
SELECT status, provider_message_id, sent_at, last_error
FROM notification_jobs
WHERE type = 'ORDER_STATUS_UPDATE_CUSTOMER'
ORDER BY created_at DESC
LIMIT 1;
```

Expected: `status = 'SENT'` with a real Mailgun message ID.

- [ ] **Step 5: Check Edge Function logs for correct log format**

In Supabase Dashboard > Edge Functions > order-status-notify > Logs, verify you see:
- `order_status_notify_started` event
- `notification_enqueue_started` event with `environment`, `correlation_id`, `notification_type`
- `notification_enqueue_success` event
- No `jwtVerify` errors, no 401 responses

- [ ] **Step 6: Rollback procedure**

```bash
git checkout supabase/functions/order-status-notify/index.ts
npx supabase functions deploy order-status-notify
```

Note: rolling back restores the broken state (jwtVerify bug). Only roll back if the deployment itself fails.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/order-status-notify/index.ts
git commit -m "fix(notifications): fix order-status-notify — remove broken jwtVerify, fix ENUM cast, add correlationId"
```

---

## Task 3: Fix enquiry-notify (ENUM casting + logging + guard)

**Severity:** Critical / Recommended (C-3, R-1, O-2, O-3)

Two RPC calls use the broken ENUM casting pattern. Additionally, this function has no `NOTIFICATIONS_ENABLED` guard, uses an inconsistent local logger, and doesn't thread a correlationId into job payloads.

The fix mirrors the create-order pattern: direct table upsert instead of `enqueue_notification` RPC.

**Files:**
- Modify: `supabase/functions/enquiry-notify/index.ts` (full file replacement)

**Interfaces:**
- Consumes: `{ enquiry_id: string }` in POST body, `x-storefront-secret` header
- Produces: `{ success: true }` always (email failures must never fail enquiry submission); job rows in `notification_jobs` with `correlationId`

- [ ] **Step 1: Write the replacement file**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logNotification } from '../_shared/log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-storefront-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const correlationId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  const log = (event: string, extra?: Record<string, unknown>) =>
    logNotification('enquiry-notify', { event, correlation_id: correlationId, ...extra });

  const storefrontSecret = Deno.env.get('STOREFRONT_API_SECRET');
  const callerSecret = req.headers.get('x-storefront-secret');
  if (!storefrontSecret || callerSecret !== storefrontSecret) {
    log('auth_failed', { reason: 'invalid_secret' });
    return json({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body?.enquiry_id) {
    log('validation_failed', { reason: 'missing_enquiry_id' });
    return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);
  }

  const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';
  if (!enabled) {
    log('notifications_disabled', { enquiry_id: body.enquiry_id });
    return json({ success: true });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: enquiry, error } = await db
    .from('enquiries')
    .select('name, email, phone, message, occasion, budget')
    .eq('id', body.enquiry_id)
    .single();

  if (error || !enquiry) {
    log('enquiry_not_found', { enquiry_id: body.enquiry_id, error: error?.message });
    return json({ success: false, error: 'ENQUIRY_NOT_FOUND' }, 404);
  }

  log('enquiry_fetched', { enquiry_id: body.enquiry_id, customer_email: enquiry.email });

  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const adminUrl = Deno.env.get('ADMIN_URL') ?? '';

  // Direct upsert — avoids PostgREST text→ENUM casting failure that affects RPC calls.
  // See create-order/index.ts for the documented explanation of this pattern.

  const customerPayload = {
    correlationId,
    name: enquiry.name,
    message: enquiry.message,
  };

  logNotification('enquiry-notify', {
    event: 'notification_enqueue_started',
    correlation_id: correlationId,
    notification_type: 'ENQUIRY_RECEIPT_CUSTOMER',
    customer_email: enquiry.email,
  });

  const { error: customerError } = await db
    .from('notification_jobs')
    .upsert(
      {
        idempotency_key: `ENQUIRY_RECEIPT_CUSTOMER:${body.enquiry_id}`,
        type: 'ENQUIRY_RECEIPT_CUSTOMER',
        recipient_email: enquiry.email,
        payload: customerPayload,
        priority: 1,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true }
    );

  if (customerError) {
    logNotification('enquiry-notify', {
      event: 'notification_enqueue_failed',
      correlation_id: correlationId,
      notification_type: 'ENQUIRY_RECEIPT_CUSTOMER',
      customer_email: enquiry.email,
      error_message: customerError.message,
      error_code: customerError.code ?? null,
    });
  } else {
    logNotification('enquiry-notify', {
      event: 'notification_enqueue_success',
      correlation_id: correlationId,
      notification_type: 'ENQUIRY_RECEIPT_CUSTOMER',
      customer_email: enquiry.email,
    });
  }

  if (adminEmail) {
    const adminPayload = {
      correlationId,
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone ?? null,
      message: enquiry.message,
      occasion: enquiry.occasion ?? null,
      budget: enquiry.budget ?? null,
      adminEnquiryUrl: `${adminUrl}/enquiries/${body.enquiry_id}`,
    };

    logNotification('enquiry-notify', {
      event: 'notification_enqueue_started',
      correlation_id: correlationId,
      notification_type: 'ENQUIRY_ADMIN_NOTIFICATION',
      customer_email: adminEmail,
    });

    const { error: adminError } = await db
      .from('notification_jobs')
      .upsert(
        {
          idempotency_key: `ENQUIRY_ADMIN_NOTIFICATION:${body.enquiry_id}`,
          type: 'ENQUIRY_ADMIN_NOTIFICATION',
          recipient_email: adminEmail,
          payload: adminPayload,
          priority: 1,
        },
        { onConflict: 'idempotency_key', ignoreDuplicates: true }
      );

    if (adminError) {
      logNotification('enquiry-notify', {
        event: 'notification_enqueue_failed',
        correlation_id: correlationId,
        notification_type: 'ENQUIRY_ADMIN_NOTIFICATION',
        customer_email: adminEmail,
        error_message: adminError.message,
        error_code: adminError.code ?? null,
      });
    } else {
      logNotification('enquiry-notify', {
        event: 'notification_enqueue_success',
        correlation_id: correlationId,
        notification_type: 'ENQUIRY_ADMIN_NOTIFICATION',
        customer_email: adminEmail,
      });
    }
  }

  log('enquiry_notify_complete', { enquiry_id: body.enquiry_id });
  return json({ success: true });
});
```

- [ ] **Step 2: Type-check**

```bash
cd supabase/functions && npx deno check enquiry-notify/index.ts
```

Expected: no errors

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy enquiry-notify
```

Expected output: `Deployed Function enquiry-notify`

- [ ] **Step 4: Verify — submit a test enquiry from the storefront**

After submitting an enquiry, query:

```sql
SELECT idempotency_key, type, status, recipient_email, created_at
FROM notification_jobs
WHERE type IN ('ENQUIRY_RECEIPT_CUSTOMER', 'ENQUIRY_ADMIN_NOTIFICATION')
ORDER BY created_at DESC
LIMIT 4;
```

Expected: Two rows (one per type), both with `status = 'PENDING'`, correct recipient emails.

Then wait up to 2 minutes for the worker:

```sql
SELECT type, status, provider_message_id, last_error
FROM notification_jobs
WHERE type IN ('ENQUIRY_RECEIPT_CUSTOMER', 'ENQUIRY_ADMIN_NOTIFICATION')
ORDER BY created_at DESC
LIMIT 2;
```

Expected: `status = 'SENT'` with real Mailgun IDs.

- [ ] **Step 5: Verify — check Edge Function logs**

In Supabase Dashboard > Edge Functions > enquiry-notify > Logs, verify:
- `auth_failed` NOT present (auth passed)
- `notification_enqueue_started` present for both types
- `notification_enqueue_success` present for both types  
- `notification_enqueue_failed` NOT present

- [ ] **Step 6: Rollback procedure**

```bash
git checkout supabase/functions/enquiry-notify/index.ts
npx supabase functions deploy enquiry-notify
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/enquiry-notify/index.ts
git commit -m "fix(notifications): fix enquiry-notify — fix ENUM cast, add NOTIFICATIONS_ENABLED guard, add correlationId"
```

---

## Task 4: Fix enquiry WhatsApp hardcoded phone fallback

**Severity:** Critical (C-5)

`const finalPhone = enquiry.phone || '+91 98765 43210'` — when `enquiry.phone` is null or empty, the WhatsApp button renders with a hardcoded placeholder number. The orders page already implements the correct conditional pattern; this task mirrors it.

**Files:**
- Modify: `app/(app)/enquiries/[id]/page.tsx`

**Interfaces:**
- Produces: WhatsApp button renders only when `enquiry.phone` is truthy; phone display shows `—` when null

- [ ] **Step 1: Fix the phone variable**

Find line 139:
```typescript
  const finalPhone = enquiry.phone || '+91 98765 43210'
```

Replace with:
```typescript
  const finalPhone = enquiry.phone ?? null
```

- [ ] **Step 2: Fix the phone display in the Customer Details card**

Find (around line 242):
```tsx
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-zinc-400 stroke-[1.5]" />
                <span>{finalPhone}</span>
              </div>
```

Replace with:
```tsx
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-zinc-400 stroke-[1.5]" />
                <span>{finalPhone ?? '—'}</span>
              </div>
```

- [ ] **Step 3: Wrap the WhatsApp button in a conditional**

Find the WhatsApp `<a>` element (around line 212). It starts with `{/* Message on WhatsApp Button */}` and ends with the closing `</a>`. The entire block looks like:

```tsx
          {/* Message on WhatsApp Button */}
          <a
            href={`https://wa.me/${finalPhone.replace(/[^\d]/g, '')}?text=Hello%20${enquiry.name},%20regarding%20your%20enquiry%20ENQ-${enquiry.id.slice(0, 8).toUpperCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-[12px] font-bold px-4 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer select-none font-sans rounded-none"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M.057 24 l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585-1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754 9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z" />
            </svg>
            Message on WhatsApp
          </a>
```

Replace the entire block with:
```tsx
          {/* Message on WhatsApp Button */}
          {finalPhone && (
            <a
              href={`https://wa.me/${finalPhone.replace(/[^\d]/g, '')}?text=Hello%20${encodeURIComponent(enquiry.name)},%20regarding%20your%20enquiry%20ENQ-${enquiry.id.slice(0, 8).toUpperCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-[12px] font-bold px-4 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer select-none font-sans rounded-none"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M.057 24 l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585-1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754 9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z" />
              </svg>
              Message on WhatsApp
            </a>
          )}
```

Note the added `encodeURIComponent` on `enquiry.name` — the original URL-encoded the name statically which would break for names with special characters.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Open an enquiry that has a phone number → WhatsApp button appears with correct link.
Open an enquiry without a phone number → WhatsApp button does NOT appear; phone field shows `—`.

- [ ] **Step 6: Rollback procedure**

```bash
git checkout "app/(app)/enquiries/[id]/page.tsx"
```

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/enquiries/[id]/page.tsx"
git commit -m "fix(ui): show enquiry WhatsApp button only when customer phone exists — remove hardcoded fallback"
```

---

## Task 5: SQL hardening migration

**Severity:** Recommended (R-2, R-3, T-1, T-2)

Three additive SQL objects:
1. `reset_dead_notification_jobs(p_job_ids UUID[])` — resets specific DEAD jobs to PENDING so the worker retries them (needed after every Mailgun incident)
2. `pg_cron` job to prune old `notification_events` (>90 days) — prevents unbounded growth
3. `pg_cron` job to prune old SENT `notification_jobs` (>30 days) — queue table housekeeping

**Files:**
- Create: `supabase/migrations/20260703_notification_hardening.sql`

**Interfaces:**
- Produces: `public.reset_dead_notification_jobs(UUID[]) RETURNS INTEGER` — returns count of rows reset

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260703_notification_hardening.sql
-- Additive hardening: dead letter recovery, event retention, job retention.
-- No schema changes. No existing objects modified.

-- ── reset_dead_notification_jobs ─────────────────────────────────────────────
-- Resets specified DEAD jobs back to PENDING so the worker retries them.
-- Call this after fixing the root cause of a delivery failure (e.g. Mailgun config).
-- Usage: SELECT reset_dead_notification_jobs(ARRAY['uuid-1'::UUID, 'uuid-2'::UUID]);
-- Returns the number of rows reset.
CREATE OR REPLACE FUNCTION public.reset_dead_notification_jobs(
  p_job_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notification_jobs
  SET
    status          = 'PENDING',
    attempts        = 0,
    last_error      = NULL,
    next_attempt_at = now(),
    updated_at      = now()
  WHERE id = ANY(p_job_ids)
    AND status = 'DEAD';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Retention: prune old notification_events ──────────────────────────────────
-- Delivery events (delivered, bounced, clicked) accumulate at ~250 rows/day.
-- Delete rows older than 90 days nightly at 3:05am.
SELECT cron.schedule(
  'prune-notification-events-90d',
  '5 3 * * *',
  $job$
  DELETE FROM public.notification_events
  WHERE received_at < now() - INTERVAL '90 days';
  $job$
);

-- ── Retention: prune old SENT notification_jobs ───────────────────────────────
-- Keep only 30 days of SENT jobs. DEAD and RETRYING rows are kept indefinitely
-- for audit purposes until manually reset or reviewed.
SELECT cron.schedule(
  'prune-sent-notification-jobs-30d',
  '10 3 * * *',
  $job$
  DELETE FROM public.notification_jobs
  WHERE status = 'SENT'
    AND sent_at < now() - INTERVAL '30 days';
  $job$
);
```

- [ ] **Step 2: Push the migration**

```bash
npx supabase db push
```

Expected output: `Applying migration 20260703_notification_hardening.sql`

- [ ] **Step 3: Verify `reset_dead_notification_jobs` exists**

```sql
SELECT proname, proargtypes::text
FROM pg_proc
WHERE proname = 'reset_dead_notification_jobs'
  AND pronamespace = 'public'::regnamespace;
```

Expected: 1 row returned

- [ ] **Step 4: Verify pg_cron jobs were created**

```sql
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN ('prune-notification-events-90d', 'prune-sent-notification-jobs-30d');
```

Expected: 2 rows, both `active = true`

- [ ] **Step 5: Test dead letter reset with a real DEAD job**

Find a DEAD job ID:
```sql
SELECT id, type, recipient_email, last_error
FROM notification_jobs
WHERE status = 'DEAD'
LIMIT 1;
```

If one exists, reset it (replace the UUID with the actual ID found above):
```sql
SELECT reset_dead_notification_jobs(ARRAY['<job-id-here>'::UUID]);
```

Expected: returns `1`

Verify:
```sql
SELECT id, status, attempts, next_attempt_at
FROM notification_jobs
WHERE id = '<job-id-here>';
```

Expected: `status = 'PENDING'`, `attempts = 0`, `next_attempt_at ≤ now()`

- [ ] **Step 6: Rollback procedure**

```sql
-- Remove cron jobs
SELECT cron.unschedule('prune-notification-events-90d');
SELECT cron.unschedule('prune-sent-notification-jobs-30d');

-- Remove function
DROP FUNCTION IF EXISTS public.reset_dead_notification_jobs(UUID[]);
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260703_notification_hardening.sql
git commit -m "feat(notifications): add dead letter reset function + retention pg_cron jobs"
```

---

## Task 6: Add notification-health HTTP endpoint

**Severity:** Recommended (O-1)

The `notification_health` view exists in the database but has no HTTP endpoint. External monitors (Uptime Robot, custom dashboards) cannot query it. This task adds a lightweight read-only edge function that exposes the view plus a derived `status` field.

**Files:**
- Create: `supabase/functions/notification-health/index.ts`

**Interfaces:**
- Produces: `GET /functions/v1/notification-health` → `{ status: 'ok'|'degraded'|'critical', dead_count: number, pending_count: number, sent_24h: number, retrying_count: number, ts: string }`

Status logic:
- `critical` — any jobs in DEAD status
- `degraded` — more than 5 jobs RETRYING
- `ok` — everything else

- [ ] **Step 1: Create the function**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: rows, error } = await db
    .from('notification_health')
    .select('status, count');

  if (error) {
    return json({ error: 'DB_ERROR', detail: error.message }, 500);
  }

  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    counts[row.status as string] = Number(row.count);
  }

  const deadCount    = counts['DEAD']       ?? 0;
  const retryCount   = counts['RETRYING']   ?? 0;
  const pendingCount = counts['PENDING']     ?? 0;
  const sentCount    = counts['SENT']        ?? 0;

  const systemStatus =
    deadCount > 0   ? 'critical' :
    retryCount > 5  ? 'degraded' :
    'ok';

  return json({
    status:        systemStatus,
    dead_count:    deadCount,
    retrying_count: retryCount,
    pending_count:  pendingCount,
    sent_24h:      sentCount,
    ts:            new Date().toISOString(),
  });
});
```

- [ ] **Step 2: Type-check**

```bash
cd supabase/functions && npx deno check notification-health/index.ts
```

Expected: no errors

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy notification-health --no-verify-jwt
```

`--no-verify-jwt` allows external monitoring tools to call this endpoint without a Supabase session. The endpoint only reads from `notification_health` (a view of aggregated counts — no PII).

- [ ] **Step 4: Verify**

```bash
curl https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-health
```

Expected response (exact values depend on current queue state):
```json
{
  "status": "ok",
  "dead_count": 0,
  "retrying_count": 0,
  "pending_count": 0,
  "sent_24h": 4,
  "ts": "2026-07-03T..."
}
```

- [ ] **Step 5: Configure external monitor (Uptime Robot or equivalent)**

Create a monitor:
- URL: `https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-health`
- Type: HTTP(S) with keyword check
- Alert keyword: `"critical"` (alert if found in response)
- Check interval: Every 5 minutes

This provides dead letter alerting without additional infrastructure (closes R-2).

- [ ] **Step 6: Rollback procedure**

```bash
# No files were modified — delete the function from Supabase dashboard if needed
npx supabase functions delete notification-health
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/notification-health/index.ts
git commit -m "feat(notifications): add notification-health HTTP endpoint for external monitoring"
```

---

## Task 7: Block test-expedite-retry from production deployment

**Severity:** Deployment Safety (C-6, D-1)

`supabase/functions/test-expedite-retry/index.ts` has no authentication and directly mutates `notification_jobs.next_attempt_at`. If accidentally deployed, it becomes a public endpoint that can force-retry arbitrary notification jobs. It must never reach production.

**Files:**
- Create: `supabase/functions/test-expedite-retry/PRODUCTION-DEPLOY-FORBIDDEN`

- [ ] **Step 1: Add a sentinel file**

Create `supabase/functions/test-expedite-retry/PRODUCTION-DEPLOY-FORBIDDEN` with content:

```
DO NOT DEPLOY THIS FUNCTION TO PRODUCTION.

This is a development utility with no authentication. It directly modifies
notification_jobs.next_attempt_at and is intended only for local testing.

Deploying it creates an unauthenticated endpoint that allows arbitrary
notification job manipulation.

To test retry behavior in development only:
  npx supabase functions deploy test-expedite-retry  # local stack only
```

- [ ] **Step 2: Add a pre-deploy reminder to CLAUDE.md**

In `CLAUDE.md`, under "Commands", add:

```markdown
**Never deploy test-expedite-retry to production:**
```bash
# Safe: deploy specific functions by name
npx supabase functions deploy create-order
npx supabase functions deploy notification-worker

# NEVER run this — deploys all functions including test-expedite-retry:
# npx supabase functions deploy  (no args)
```
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/test-expedite-retry/PRODUCTION-DEPLOY-FORBIDDEN CLAUDE.md
git commit -m "docs(notifications): mark test-expedite-retry as dev-only, never deploy to production"
```

---

## End-to-End Production Validation Matrix

Run this matrix in order after all tasks are complete. Every check must pass before declaring production-ready.

### Pre-flight: Verify secrets are configured

In Supabase Dashboard > Project Settings > Edge Functions > Secrets:

| Secret | Required value | How to verify |
|---|---|---|
| `NOTIFICATIONS_ENABLED` | `true` | Check dashboard |
| `MAILGUN_API_KEY` | Non-empty | Check dashboard |
| `MAILGUN_DOMAIN` | Non-empty (production domain, not sandbox) | Check dashboard |
| `MAILGUN_FROM` | Non-empty (or derived from domain) | Check dashboard |
| `ADMIN_EMAIL` | Your admin email | Check dashboard |
| `ADMIN_URL` | Admin panel URL, no trailing slash | Check dashboard |
| `WORKER_SECRET` | Non-empty, matches GUC below | Check dashboard |
| `STOREFRONT_API_SECRET` | Non-empty, matches storefront .env | Check dashboard |
| `ENVIRONMENT` | `production` | Check dashboard |

In the database (required for pg_cron):
```sql
-- Verify GUCs are set (values will be shown)
SHOW app.notification_worker_url;
SHOW app.worker_secret;
```

Both must return non-empty strings. The `app.worker_secret` must match the `WORKER_SECRET` edge function secret.

---

### CHECK-1: Worker authentication

```bash
# Must return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `401`

```bash
# Must return 200 (replace <WORKER_SECRET> with actual value)
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: <WORKER_SECRET>" \
  -d '{}'
```
Expected: `200`

**Pass criteria:** First returns 401, second returns 200.

---

### CHECK-2: pg_cron schedule is active

```sql
SELECT jobname, schedule, active, jobid
FROM cron.job
WHERE jobname = 'process-notification-queue';
```

Expected: 1 row, `active = true`

```sql
-- Wait 5 minutes, then check last run time
SELECT jobname, start_time, status, return_message
FROM cron.job_run_details
WHERE jobname = 'process-notification-queue'
ORDER BY start_time DESC
LIMIT 3;
```

Expected: Recent runs with `status = 'succeeded'`

**Pass criteria:** Job active, recent runs succeeded.

---

### CHECK-3: Order confirmation emails (AC1 + AC2)

Place a test order through the storefront (use an authorized Mailgun recipient email). Wait 5 minutes. Then:

```sql
SELECT type, status, recipient_email, provider_message_id, last_error, created_at
FROM notification_jobs
WHERE type IN ('ORDER_CONFIRMATION_CUSTOMER', 'ORDER_CONFIRMATION_ADMIN')
ORDER BY created_at DESC
LIMIT 4;
```

Expected: Two rows (one per type), `status = 'SENT'`, `provider_message_id` not null.

**Pass criteria:** Both types SENT, Mailgun IDs present.

---

### CHECK-4: Order status update emails (AC3)

In the admin panel, open the test order from CHECK-3. Change status to CONFIRMED.

```sql
SELECT type, status, recipient_email, provider_message_id, last_error, payload->>'correlationId'
FROM notification_jobs
WHERE type = 'ORDER_STATUS_UPDATE_CUSTOMER'
ORDER BY created_at DESC
LIMIT 1;
```

Wait 5 minutes:

Expected: `status = 'SENT'`, `provider_message_id` not null, `correlationId` is a UUID.

Repeat for PROCESSING, SHIPPED, DELIVERED, CANCELLED.

```sql
-- PENDING must NOT create a notification job
SELECT COUNT(*) FROM notification_jobs
WHERE type = 'ORDER_STATUS_UPDATE_CUSTOMER'
  AND created_at > now() - INTERVAL '1 hour'
  AND payload->>'newStatus' = 'PENDING';
```

Expected: `0`

**Pass criteria:** CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED each create and send a job. PENDING creates no job.

---

### CHECK-5: Enquiry emails (AC4 + AC5)

Submit a test enquiry through the storefront. Wait 5 minutes.

```sql
SELECT type, status, recipient_email, provider_message_id, last_error, payload->>'correlationId'
FROM notification_jobs
WHERE type IN ('ENQUIRY_RECEIPT_CUSTOMER', 'ENQUIRY_ADMIN_NOTIFICATION')
ORDER BY created_at DESC
LIMIT 4;
```

Expected: Two rows, `status = 'SENT'`, `provider_message_id` not null.

**Pass criteria:** Both types SENT with Mailgun IDs.

---

### CHECK-6: WhatsApp links (AC6 + AC7)

**Order with phone:** Open an order whose customer has a phone number. Verify the green "Message on WhatsApp" button appears and the `href` contains `wa.me/<digits-only-phone>?text=Hello+...`.

**Order without phone:** Open an order whose customer has no phone. Verify the WhatsApp button does NOT appear.

**Enquiry with phone:** Open an enquiry that has a phone. Verify the WhatsApp button appears and `href` contains the actual phone number, not `+91 98765 43210`.

**Enquiry without phone:** Open an enquiry that has no phone. Verify the WhatsApp button does NOT appear and the phone field shows `—`.

**Pass criteria:** All four cases behave as expected.

---

### CHECK-7: Email failure isolation

Verify that a notification failure does NOT affect order creation or enquiry submission. Run Task 6's smoke test with an unauthorized recipient email — the job should go DEAD after 3 retries, but the order/enquiry itself should be CONFIRMED/submitted.

```sql
-- After placing an order with an unauthorized recipient, verify order exists
SELECT id, order_number, status FROM orders ORDER BY created_at DESC LIMIT 1;
```

Expected: Order exists with `status = 'PENDING'` (or whatever checkout sets it to).

```sql
-- Verify DEAD job exists (failure was isolated)
SELECT status, last_error, attempts FROM notification_jobs
WHERE recipient_email = '<unauthorized-email>'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `status = 'DEAD'`, `attempts = 3`, `last_error` contains Mailgun 403 message.

**Pass criteria:** Order created successfully despite notification failure.

---

### CHECK-8: Health endpoint

```bash
curl -s https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-health | python -m json.tool
```

Expected:
```json
{
  "status": "ok",
  "dead_count": 0,
  "retrying_count": 0,
  "pending_count": 0,
  "sent_24h": <number>,
  "ts": "<ISO timestamp>"
}
```

If `dead_count > 0`, use `reset_dead_notification_jobs()` to clear them and re-run CHECK-4/CHECK-5.

**Pass criteria:** `status = 'ok'`, `dead_count = 0`.

---

### CHECK-9: Dead letter recovery

```sql
-- Manually create a synthetic DEAD job to test reset
INSERT INTO notification_jobs (idempotency_key, type, recipient_email, payload, status, attempts, max_attempts, last_error)
VALUES (
  'HEALTH_CHECK_DEAD_JOB:' || gen_random_uuid(),
  'ORDER_CONFIRMATION_CUSTOMER',
  'test@example.com',
  '{"correlationId": "test", "customerName": "Test", "orderNumber": "TEST-001", "items": [], "total": 0}',
  'DEAD',
  3,
  3,
  'Synthetic dead job for recovery test'
);

-- Get its ID
SELECT id FROM notification_jobs WHERE idempotency_key LIKE 'HEALTH_CHECK_DEAD_JOB%' ORDER BY created_at DESC LIMIT 1;
```

```sql
-- Reset it
SELECT reset_dead_notification_jobs(ARRAY['<id-from-above>'::UUID]);
```

Expected: returns `1`

```sql
-- Verify reset
SELECT status, attempts, next_attempt_at FROM notification_jobs WHERE id = '<id-from-above>';
```

Expected: `status = 'PENDING'`, `attempts = 0`, `next_attempt_at ≤ now()`

```sql
-- Clean up the test job
DELETE FROM notification_jobs WHERE idempotency_key LIKE 'HEALTH_CHECK_DEAD_JOB%';
```

**Pass criteria:** `reset_dead_notification_jobs()` returns 1, job becomes PENDING.

---

### CHECK-10: Retention jobs registered

```sql
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN (
  'process-notification-queue',
  'prune-notification-events-90d',
  'prune-sent-notification-jobs-30d'
);
```

Expected: 3 rows, all `active = true`.

**Pass criteria:** All three cron jobs active.

---

### Production-Ready Declaration

Mark the system as production-ready only when **all 10 checks pass**:

```
[ ] CHECK-1: Worker authentication — unauthenticated requests rejected
[ ] CHECK-2: pg_cron schedule active and succeeding
[ ] CHECK-3: Order confirmation emails SENT (AC1 + AC2)
[ ] CHECK-4: Status update emails SENT for all notifiable statuses (AC3)
[ ] CHECK-5: Enquiry emails SENT (AC4 + AC5)
[ ] CHECK-6: WhatsApp buttons conditional on phone presence (AC6 + AC7)
[ ] CHECK-7: Email failures isolated from order creation / enquiry submission
[ ] CHECK-8: Health endpoint returns status=ok, dead_count=0
[ ] CHECK-9: Dead letter reset function works
[ ] CHECK-10: All retention cron jobs registered and active
```

Update `progress.md` Task 9 with the completion timestamp and check results.
