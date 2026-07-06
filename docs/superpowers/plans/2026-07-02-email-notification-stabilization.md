# Plan A — Email Notification Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore and verify end-to-end delivery of order-confirmation emails (customer + admin) through the existing `notification_jobs` queue → `notification-worker` → Mailgun pipeline, with structured observability, and prove delivery in production — without touching checkout, Razorpay, order creation, inventory, or the storefront.

**Architecture:** The queue system already exists (migration `20260701_notification_queue.sql`). This plan is a **root-cause fix + observability + verification** effort, not a rebuild. It (1) captures live evidence, (2) classifies the confirmed cause from a fixed decoder, (3) applies the smallest matching fix among a known-bounded candidate set, (4) adds the Phase-6 structured-log schema to `create-order` and `notification-worker`, and (5) verifies TEST 1/2/5/6 end-to-end plus a regression pass, then a production rollout checklist.

**Tech Stack:** Deno + TypeScript (Supabase edge functions), Mailgun REST API (fetch, no SDK), `@supabase/supabase-js@2` (jsr), Postgres (pg_cron + pg_net), Supabase CLI 2.108.0.

## Global Constraints

- **Zero regressions.** No change may affect checkout, Razorpay signature verification, `create_order_txn`, inventory decrement, admin dashboard, order details, storefront, cart, search, or the enquiry flow.
- **Email failure must never fail the primary operation.** All enqueue calls in `create-order` remain `await Promise.allSettled([...])` with per-call error logging (current pattern, `create-order/index.ts:290-295`). The order response is returned regardless.
- **Smallest possible change.** No refactoring, no unrelated modifications. Preserve API contracts, idempotency (`idempotency_key` unique), retry behaviour (`fail_notification_job` backoff 30/60/120s, max_attempts=3), payload formats, and DB schema unless a confirmed root cause requires otherwise.
- **No assumptions.** Every fix task is gated on a specific evidence result from Task 1 (see Task 2 decoder). Do not apply a fix whose triggering evidence was not observed.
- **WhatsApp is out of scope.** Do not add WhatsApp notification types, providers, or automated sends. Existing `wa.me` deep-links in `email-templates.ts:63-76` and detail pages stay byte-for-byte unchanged. Automated WhatsApp is Plan B.
- **Structured logs only.** In the Supabase edge runtime the sole log transport is stdout/stderr; structured logging is therefore `console.log(JSON.stringify(...))` routed through a single shared helper. "No `console.log`" means **no naked/unstructured `console.log`** — every log line is a JSON object with the required fields. Bare `console.log('text')` / `console.error(x)` are disallowed after Task 6.
- **Required log fields** (Phase 6) on every notification log line, `null` when genuinely unavailable: `order_id`, `order_number`, `customer_id`, `customer_email`, `customer_phone`, `notification_type`, `provider`, `provider_message_id`, `error_code`, `error_message`, `correlation_id`.
- **Event names** (Phase 6): `notification_enqueue_started`, `notification_enqueue_success`, `notification_enqueue_failed` (in `create-order`); `provider_request_started`, `provider_request_success`, `provider_request_failed` (in `notification-worker`).
- `deno check` must pass on every modified edge-function file before its commit.
- `npx tsc --noEmit` must pass before any commit that touches Next.js/TypeScript app files (none expected in this plan).
- **Not complete until verified end-to-end in production.** The Definition of Done requires a real order (or authorized test order) producing a Mailgun `delivered` event to both customer and admin, evidenced by DB + worker logs + Mailgun logs.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `docs/superpowers/evidence/2026-07-02-email-evidence-capture.sql` | Exists | Read-only Phase 2/3 evidence queries (A1–A6) |
| `supabase/config.toml` | Modify | Add `[functions.notification-worker] verify_jwt = false` (only if cause #2 confirmed) |
| `supabase/functions/_shared/log.ts` | Create | Shared structured notification logger emitting the Phase-6 schema |
| `supabase/functions/_shared/log.test.ts` | Create | Deno test proving the logger always emits required fields |
| `supabase/functions/notification-worker/index.ts` | Modify | Emit `provider_request_*` events with required fields + correlation_id |
| `supabase/functions/create-order/index.ts` | Modify | Emit `notification_enqueue_*` events; thread `correlationId` into job payload |
| `supabase/functions/_shared/email-provider.ts` | Modify | (Only if cause #1 confirmed) make production no-op impossible to mistake for delivery |

**Explicitly NOT modified:** `create_order_txn` (migration), Razorpay verification, `email-templates.ts`, `mailgun-provider.ts` logic (config-only via secrets), storefront, admin UI.

---

## Rollback Strategy

- Code changes (Tasks 6) are additive logging + an import; revert by `git revert` of the two commits. No schema or contract change.
- Config changes (Tasks 3–5) are Supabase secrets / `config.toml` / cron re-schedule — reversible by restoring prior secret values and re-deploying. Kill switch: set `NOTIFICATIONS_ENABLED=false` to stop all enqueueing and sending instantly with no deploy.
- `verify_jwt` change is per-function config; revert by removing the `[functions.notification-worker]` block and redeploying.

---

## Task 1: Capture Live Evidence (Phase 2/3) — READ ONLY

**Files:**
- Uses: `docs/superpowers/evidence/2026-07-02-email-evidence-capture.sql`

**Interfaces:**
- Produces: a findings record (paste of A1–A6 results, B1–B3 outputs, Mailgun state) used by Task 2.

- [ ] **Step 1: Run SQL A1–A6**

Run every query in `docs/superpowers/evidence/2026-07-02-email-evidence-capture.sql` in Supabase Dashboard → SQL Editor. Record each result verbatim.

Expected: A1 returns one row per status; note whether any SENT row has `noop_marked_sent > 0`.

- [ ] **Step 2: Run config + log commands**

```bash
supabase secrets list --project-ref hjhqemsyufsifmgespur
supabase functions logs notification-worker --project-ref hjhqemsyufsifmgespur
supabase functions logs create-order --project-ref hjhqemsyufsifmgespur
```

Record: presence of `ENVIRONMENT`, `NOTIFICATIONS_ENABLED`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`, `MAILGUN_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_URL`, `WORKER_SECRET`. From worker logs, note whether `job_sent` shows `messageId:"noop-..."` vs a real Mailgun id vs `job_failed`. From create-order logs, note the `notifications_config` line (`enabled` bool) and whether `enqueue_customer_success` / `enqueue_admin_success` appear.

- [ ] **Step 3: Capture Mailgun provider state**

Mailgun Dashboard → Sending → Logs, filter by the test recipient. Record message state: `accepted` / `delivered` / `failed` / `suppressed (unauthorized recipient)` and any error text.

- [ ] **Step 4: Write the findings record**

Create `docs/superpowers/evidence/2026-07-02-findings.md` with the raw A1–A6 outputs, secret presence table, relevant log lines, and Mailgun state. This is the evidence artifact the Definition of Done references.

- [ ] **Step 5: Commit the evidence**

```bash
git add docs/superpowers/evidence/2026-07-02-email-evidence-capture.sql docs/superpowers/evidence/2026-07-02-findings.md
git commit -m "chore(notifications): capture Phase 2/3 email pipeline evidence"
```

---

## Task 2: Classify Root Cause (Decoder)

**Files:**
- Uses: `docs/superpowers/evidence/2026-07-02-findings.md`

**Interfaces:**
- Produces: a confirmed cause list `{#1?, #2?, #3?, #4?}` that gates Tasks 3–5.

- [ ] **Step 1: Apply the decoder to the findings**

| Evidence observed in Task 1 | Confirmed cause | Fix task |
|---|---|---|
| A1/A2: SENT rows with `provider_message_id LIKE 'noop-%'`; worker log `messageId:"noop-..."`; `ENVIRONMENT` unset or ≠ `production`, or `NOTIFICATIONS_ENABLED` ≠ `true` | **#1 No-op provider gate** (`email-provider.ts:10,13`) | Task 3 |
| A2: jobs stuck `PENDING`, `attempts=0`; AND (A5 `status_code=401`) OR (A6 `worker_url` NULL / `worker_secret_present=false`) OR (A4 `return_message` error) | **#2 Worker never invoked** (verify_jwt gateway 401 / unset GUCs / secret mismatch) | Task 4 |
| A2: jobs `DEAD`/`RETRYING` with real `last_error` (Mailgun `4xx/5xx`, `authorized recipients`, wrong region); Mailgun log `failed`/`suppressed` | **#4 Mailgun misconfig** (`mailgun-provider.ts` config via secrets) | Task 5 |
| A2: **no rows**; create-order log `enabled:false` or missing `enqueue_customer_success` | **#3 Not enqueued** (`NOTIFICATIONS_ENABLED` off in create-order env) | Task 3 (secret set) |

- [ ] **Step 2: Record the confirmed cause(s)**

Append a "Confirmed root cause(s)" section to `docs/superpowers/evidence/2026-07-02-findings.md` naming each confirmed cause with the exact evidence line(s) that prove it (file/line for code, query row for data). Do not proceed to a fix whose evidence was not observed.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/evidence/2026-07-02-findings.md
git commit -m "docs(notifications): classify confirmed email root cause(s) from evidence"
```

---

## Task 3: Fix — Configuration Gate (causes #1 and #3)

**Apply only if cause #1 or #3 was confirmed in Task 2.**

**Files:**
- Config only (Supabase secrets). Optionally: `supabase/functions/_shared/email-provider.ts` (Step 4).

**Interfaces:**
- Consumes: `createEmailProvider()` reads `ENVIRONMENT`, `NOTIFICATIONS_ENABLED`.
- Produces: production provider returns real Mailgun message ids (not `noop-`).

- [ ] **Step 1: Set the gating secrets (shared across all functions in the project)**

```bash
supabase secrets set NOTIFICATIONS_ENABLED=true --project-ref hjhqemsyufsifmgespur
supabase secrets set ENVIRONMENT=production --project-ref hjhqemsyufsifmgespur
```

Rationale (proven): `email-provider.ts:13` no-ops when `!enabled || env === 'development'`, and `env` defaults to `'development'` at L10 when unset. Both must be correct for a real send. `NOTIFICATIONS_ENABLED=true` is also what gates enqueueing in `create-order/index.ts:200,210`.

- [ ] **Step 2: Redeploy the functions that read these secrets**

```bash
supabase functions deploy create-order --project-ref hjhqemsyufsifmgespur
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
```

- [ ] **Step 3: Verify the gate now selects the real provider**

Insert a test job and invoke the worker (see Task 7 Step 1 for the exact commands). Then:

```sql
SELECT status, provider_message_id
FROM notification_jobs
WHERE idempotency_key LIKE 'TEST_STABILIZE_%'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `status='SENT'` and `provider_message_id` is a real Mailgun id (contains `@`), **not** `noop-...`.

- [ ] **Step 4 (hardening, optional but recommended): make a production no-op impossible to mistake for delivery**

Only if the team wants defense-in-depth against a future misconfig silently marking jobs SENT. In `supabase/functions/_shared/email-provider.ts`, change the guard so a production environment with notifications enabled never returns the no-op, and the no-op path is unmistakable:

```typescript
export function createEmailProvider(): EmailProvider {
  const env = Deno.env.get('ENVIRONMENT') ?? 'development';
  const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';

  // Only development OR an explicitly-disabled pipeline uses the no-op sender.
  // A production environment with notifications enabled MUST use the real provider.
  if (env === 'production' && enabled) {
    return new MailgunProvider();
  }

  return {
    async send(opts) {
      console.log(JSON.stringify({
        level: 'warn',
        service: 'email-provider',
        mode: 'noop',
        reason: enabled ? `non_production_env:${env}` : 'notifications_disabled',
        to: opts.to,
        subject: opts.subject,
      }));
      return `noop-${crypto.randomUUID()}`;
    },
  };
}
```

This preserves the existing dev no-op contract (still returns `noop-` id) and changes no caller.

- [ ] **Step 5: Type-check and commit (only if Step 4 applied)**

```bash
deno check supabase/functions/_shared/email-provider.ts
git add supabase/functions/_shared/email-provider.ts
git commit -m "fix(notifications): production+enabled always uses real Mailgun provider"
```

---

## Task 4: Fix — Worker Invocation (cause #2)

**Apply only if cause #2 was confirmed in Task 2.** Sub-steps are gated by which sub-signal fired (A5 401 vs A6 unset GUCs vs A4 error).

**Files:**
- Modify: `supabase/config.toml` (verify_jwt) — if A5 showed 401.
- Cron re-schedule SQL — if A6 showed unset GUCs or A3 showed the hardcoded testing secret.

**Interfaces:**
- Produces: pg_cron `net.http_post` → worker returns HTTP 200 and processes jobs.

- [ ] **Step 1 (if A5 `status_code=401`): disable JWT verification on the worker**

The worker authenticates callers with `x-worker-secret` in its own code (`notification-worker/index.ts:34-41`); the gateway JWT check is redundant and blocks pg_cron (which sends no bearer token). Add to `supabase/config.toml`:

```toml
[functions.notification-worker]
verify_jwt = false
```

Then redeploy:

```bash
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
```

- [ ] **Step 2 (if A6 GUCs unset OR A3 shows hardcoded `testing-secret-12345`): align the worker secret and re-schedule cron from GUCs**

Set the function secret and matching DB GUCs, then rebuild the schedule to read the GUCs (reverting the hardcoded test secret in `update_schedule_simple.sql`):

```sql
-- Choose one strong secret; use the SAME value in both places.
-- Generate with: openssl rand -hex 32
ALTER DATABASE postgres SET app.notification_worker_url =
  'https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker';
ALTER DATABASE postgres SET app.worker_secret = '<STRONG_SECRET>';

SELECT cron.unschedule('process-notification-queue');
SELECT cron.schedule(
  'process-notification-queue',
  '*/2 * * * *',
  $job$
  SELECT net.http_post(
    url     := current_setting('app.notification_worker_url', true),
    headers := json_build_object(
      'Content-Type',    'application/json',
      'x-worker-secret', current_setting('app.worker_secret', true)
    )::jsonb,
    body    := '{}'::jsonb
  )
  $job$
);
```

```bash
supabase secrets set WORKER_SECRET=<STRONG_SECRET> --project-ref hjhqemsyufsifmgespur
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
```

`app.worker_secret` (sent by cron) MUST equal `WORKER_SECRET` (checked at worker L38), or the worker returns 401.

- [ ] **Step 3: Force a cron tick and verify a 200 response**

Wait up to 2 minutes for the schedule, or invoke `net.http_post` once manually via SQL editor using the same body. Then:

```sql
SELECT status_code, (content::text) AS body, created
FROM net._http_response
ORDER BY created DESC LIMIT 3;
```

Expected: `status_code = 200`, body like `{"processed":N,...}`.

- [ ] **Step 4: Verify no jobs remain stuck PENDING**

```sql
SELECT status, COUNT(*) FROM notification_jobs
WHERE created_at > now() - INTERVAL '15 minutes'
GROUP BY status;
```

Expected: recent jobs progress to `SENT` (or `DEAD` with a real Mailgun error if cause #4 also present), none stuck `PENDING` with `attempts=0`.

- [ ] **Step 5: Commit config change (if Step 1 applied)**

```bash
git add supabase/config.toml
git commit -m "fix(notifications): disable redundant verify_jwt on notification-worker so pg_cron can invoke it"
```

---

## Task 5: Fix — Mailgun Configuration (cause #4)

**Apply only if cause #4 was confirmed in Task 2.**

**Files:**
- Config only (Supabase secrets). `mailgun-provider.ts` logic unchanged.

**Interfaces:**
- Consumes: `MailgunProvider` reads `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`, `MAILGUN_BASE_URL` (`mailgun-provider.ts:16-28`).

- [ ] **Step 1: Map the Mailgun error to the setting**

| `last_error` / Mailgun log | Fix |
|---|---|
| `401 Unauthorized` | `MAILGUN_API_KEY` wrong/rotated — reset it |
| `404` on `/v3/<domain>/messages` | `MAILGUN_DOMAIN` wrong, or EU domain hitting US base — set `MAILGUN_BASE_URL=https://api.eu.mailgun.net` |
| `Free accounts are for test purposes only… authorized recipients` / `suppressed` | Sandbox domain — add authorized recipient in Mailgun, OR set a verified `MAILGUN_DOMAIN` |
| `from ... not allowed` | `MAILGUN_FROM` not on the verified domain — set `MAILGUN_FROM="MEI Bridal Couture <noreply@<verified-domain>>"` |

- [ ] **Step 2: Set the corrected secret(s)**

```bash
# Only the ones the error indicates, e.g.:
supabase secrets set MAILGUN_DOMAIN=<verified-domain> --project-ref hjhqemsyufsifmgespur
supabase secrets set MAILGUN_FROM="MEI Bridal Couture <noreply@<verified-domain>>" --project-ref hjhqemsyufsifmgespur
# If EU region:
supabase secrets set MAILGUN_BASE_URL=https://api.eu.mailgun.net --project-ref hjhqemsyufsifmgespur
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
```

- [ ] **Step 3: Re-run a test job (Task 7 Step 1) and confirm Mailgun `accepted` then `delivered`**

Expected: job `status='SENT'` with real message id; Mailgun log shows `delivered` to the recipient.

---

## Task 6: Observability — Phase 6 Structured Logging

**Unconditional** (spec-required regardless of root cause).

**Files:**
- Create: `supabase/functions/_shared/log.ts`
- Create: `supabase/functions/_shared/log.test.ts`
- Modify: `supabase/functions/notification-worker/index.ts`
- Modify: `supabase/functions/create-order/index.ts`

**Interfaces:**
- Produces: `logNotification(service: string, fields: NotificationLogFields): void` — emits one JSON line with all required fields (null when absent).
- Consumes (worker): wraps `provider.send` with `provider_request_started/success/failed`.
- Consumes (create-order): wraps the two upserts with `notification_enqueue_started/success/failed`; writes `correlationId` into each job payload.

- [ ] **Step 1: Write the failing logger test**

Create `supabase/functions/_shared/log.test.ts`:

```typescript
import { assertEquals } from 'jsr:@std/assert@1';
import { buildLogLine } from './log.ts';

Deno.test('buildLogLine always includes every required field, defaulting to null', () => {
  const line = buildLogLine('notification-worker', {
    event: 'provider_request_success',
    correlation_id: 'corr-1',
    notification_type: 'ORDER_CONFIRMATION_CUSTOMER',
    provider: 'mailgun',
    provider_message_id: 'abc@mg',
  });
  const obj = JSON.parse(line);
  for (const k of [
    'order_id', 'order_number', 'customer_id', 'customer_email', 'customer_phone',
    'notification_type', 'provider', 'provider_message_id', 'error_code',
    'error_message', 'correlation_id', 'event', 'service', 'ts',
  ]) {
    assertEquals(k in obj, true, `missing field ${k}`);
  }
  assertEquals(obj.order_id, null);
  assertEquals(obj.provider_message_id, 'abc@mg');
  assertEquals(obj.event, 'provider_request_success');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/_shared/log.test.ts`
Expected: FAIL — `Module not found` / `buildLogLine is not exported`.

- [ ] **Step 3: Write the logger**

Create `supabase/functions/_shared/log.ts`:

```typescript
// Shared structured logger for the notification pipeline (Phase 6).
// The Supabase edge runtime's only log sink is stdout; structured logging is
// therefore console.log(JSON.stringify(...)) via this single helper. Do not add
// naked console.log elsewhere in the notification path.

export type NotificationEvent =
  | 'notification_enqueue_started'
  | 'notification_enqueue_success'
  | 'notification_enqueue_failed'
  | 'provider_request_started'
  | 'provider_request_success'
  | 'provider_request_failed';

export interface NotificationLogFields {
  event: NotificationEvent;
  correlation_id: string;
  order_id?: string | null;
  order_number?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  notification_type?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  [k: string]: unknown;
}

export function buildLogLine(service: string, fields: NotificationLogFields): string {
  const required = {
    order_id: null as unknown,
    order_number: null as unknown,
    customer_id: null as unknown,
    customer_email: null as unknown,
    customer_phone: null as unknown,
    notification_type: null as unknown,
    provider: null as unknown,
    provider_message_id: null as unknown,
    error_code: null as unknown,
    error_message: null as unknown,
  };
  return JSON.stringify({
    service,
    environment: Deno.env.get('ENVIRONMENT') ?? 'unknown',
    ts: new Date().toISOString(),
    ...required,
    ...fields,
  });
}

export function logNotification(service: string, fields: NotificationLogFields): void {
  console.log(buildLogLine(service, fields));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/_shared/log.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 5: Wire the worker to emit `provider_request_*`**

In `supabase/functions/notification-worker/index.ts`, add the import after line 4:

```typescript
import { logNotification } from '../_shared/log.ts';
```

Replace the per-job send block (`notification-worker/index.ts:77-104`) so each provider call emits started/success/failed with the required fields and a correlation id read from the payload:

```typescript
    const start = Date.now();
    const correlationId = (job.payload?.correlationId as string) ?? job.id;
    const baseFields = {
      correlation_id: correlationId,
      notification_type: job.type,
      customer_email: job.recipient_email,
      order_id: (job.payload?.orderId as string) ?? null,
      order_number: (job.payload?.orderNumber as string) ?? null,
      customer_id: (job.payload?.customerId as string) ?? null,
      customer_phone: (job.payload?.customerPhone as string) ?? null,
      provider: 'mailgun',
    };

    logNotification('notification-worker', { event: 'provider_request_started', ...baseFields });

    try {
      const { subject, html } = renderTemplate(job.type, job.payload);
      const messageId = await provider.send({ to: job.recipient_email, subject, html });

      await db.rpc('complete_notification_job', {
        p_job_id: job.id,
        p_provider_message_id: messageId,
      });

      logNotification('notification-worker', {
        event: 'provider_request_success',
        ...baseFields,
        provider_message_id: messageId,
      });
      jobLog('job_sent', { messageId, durationMs: Date.now() - start });
      results.push({ jobId: job.id, status: 'sent' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await db.rpc('fail_notification_job', { p_job_id: job.id, p_error: errMsg });

      logNotification('notification-worker', {
        event: 'provider_request_failed',
        ...baseFields,
        error_message: errMsg,
        error_code: errMsg.match(/Mailgun (\d{3})/)?.[1] ?? null,
      });
      jobLog('job_failed', { error: errMsg, durationMs: Date.now() - start });
      results.push({ jobId: job.id, status: 'failed', error: errMsg });
    }
```

(The existing `structuredLog`/`jobLog` lifecycle lines stay; they are already JSON. This adds the Phase-6-named events.)

- [ ] **Step 6: Wire create-order to emit `notification_enqueue_*` and thread correlation_id**

In `supabase/functions/create-order/index.ts`, add the import after line 1:

```typescript
import { logNotification } from '../_shared/log.ts';
```

In the enqueue block (`create-order/index.ts:210-296`): (a) add `correlationId: requestId` to both `customerPayload` and `adminPayload`; (b) replace the existing `log('notification_enqueue_started', ...)` at L229 with a `logNotification(...)` call and add success/failed events in the `.then(({ error }) => ...)` handlers. Example for the customer upsert handler (mirror for admin):

```typescript
        const enqueueFields = {
          correlation_id: requestId,
          order_id: String(data.order_id),
          order_number: data.order_number,
          customer_email: body.customer.email,
          customer_phone: body.customer.phone ?? null,
          provider: 'queue',
        };

        logNotification('create-order', {
          event: 'notification_enqueue_started',
          ...enqueueFields,
          notification_type: 'ORDER_CONFIRMATION_CUSTOMER',
        });

        // ...inside the customer upsert .then(({ error }) => { ... }):
        if (error) {
          logNotification('create-order', {
            event: 'notification_enqueue_failed',
            ...enqueueFields,
            notification_type: 'ORDER_CONFIRMATION_CUSTOMER',
            error_message: error.message,
            error_code: (error as any).code ?? null,
          });
        } else {
          logNotification('create-order', {
            event: 'notification_enqueue_success',
            ...enqueueFields,
            notification_type: 'ORDER_CONFIRMATION_CUSTOMER',
          });
        }
```

Keep the existing `log('enqueue_customer_success'...)` lines or remove them — but do not leave any bare-string `console.log`. The `log()` helper at L69-70 already emits JSON; it may remain for request-level tracing, but all notification-specific lines must use `logNotification`.

- [ ] **Step 7: Type-check both functions**

```bash
deno check supabase/functions/notification-worker/index.ts
deno check supabase/functions/create-order/index.ts
```

Expected: no errors.

- [ ] **Step 8: Deploy and commit**

```bash
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
supabase functions deploy create-order --project-ref hjhqemsyufsifmgespur
git add supabase/functions/_shared/log.ts supabase/functions/_shared/log.test.ts \
        supabase/functions/notification-worker/index.ts supabase/functions/create-order/index.ts
git commit -m "feat(notifications): add Phase-6 structured logging with correlation ids"
```

---

## Task 7: Email Test Matrix (TEST 1, 2, 5, 6)

WhatsApp TEST 3/4/7 are out of scope for Plan A.

**Files:** none (runtime verification).

- [ ] **Step 1: TEST 1 — authorized recipient, full path**

```sql
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST_STABILIZE_' || gen_random_uuid(),
  p_type            := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := '<authorized-test-inbox>',
  p_payload         := jsonb_build_object(
    'customerName','Test One','orderNumber','TEST-1',
    'items', jsonb_build_array(jsonb_build_object('name','Item','quantity',1)),
    'total',5000,'correlationId','test-1'),
  p_priority := 1
);
```

Invoke the worker:

```bash
curl -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" -H "x-worker-secret: <WORKER_SECRET>" -d '{}'
```

Expected: response `{"processed":>=1,...}`; job → `SENT` with real Mailgun id; worker log `provider_request_success`; **Mailgun `delivered`**; email received.

- [ ] **Step 2: TEST 2 — unauthorized/failing recipient → DEAD after retries**

Enqueue as above with a recipient Mailgun will reject (e.g. an unverified address on a sandbox domain). Invoke the worker up to `max_attempts` times (or wait for backoff).
Expected: `provider_request_failed` logged each attempt; after 3 attempts `status='DEAD'` with `last_error` = Mailgun rejection; order/payment unaffected.

- [ ] **Step 3: TEST 5 — idempotency / duplicate**

Enqueue twice with the **same** `idempotency_key`:

```sql
SELECT public.enqueue_notification('DUP_TEST_1','ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,'<inbox>','{"correlationId":"dup"}'::jsonb,1);
SELECT public.enqueue_notification('DUP_TEST_1','ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,'<inbox>','{"correlationId":"dup"}'::jsonb,1);
SELECT COUNT(*) FROM notification_jobs WHERE idempotency_key='DUP_TEST_1';
```

Expected: second call returns `{"enqueued":false,"reason":"DUPLICATE"}`; `COUNT(*) = 1`; exactly one email. Also confirm a duplicate create-order (same `payment_id`) yields `already_exists=true` and enqueues nothing new (`create-order/index.ts:197`).

- [ ] **Step 4: TEST 6 — Mailgun unavailable, failure isolated**

Temporarily set an invalid `MAILGUN_BASE_URL` (e.g. `https://api.invalid.mailgun.test`), redeploy worker, place/enqueue an order-confirmation job.
Expected: order creation still returns `success:true` (create-order never calls Mailgun); job goes `RETRYING`→`DEAD`; no impact on checkout/payment. Restore `MAILGUN_BASE_URL` afterward.

- [ ] **Step 5: Record matrix results in findings**

Append TEST 1/2/5/6 outcomes (with job ids + Mailgun message ids) to `docs/superpowers/evidence/2026-07-02-findings.md` and commit.

---

## Task 8: Regression Testing (Phase 8)

**Files:** none (verification). Confirm no behavior changed outside the notification path.

- [ ] **Step 1: Checkout + payment + order creation + inventory**

Place one real (or bypass-mode) order end-to-end. Verify: Razorpay signature still verified (`create-order/index.ts:119`), `create_order_txn` returns an order, inventory decremented, response shape unchanged (`success, order_id, order_number, total`). A Mailgun outage must NOT change any of these.

- [ ] **Step 2: Admin dashboard, order details, status change**

Open admin → dashboard stats load; open an order → details render; change status → updates instantly (fire-and-forget notify unchanged). Confirm the `wa.me` button on the order detail page is unchanged.

- [ ] **Step 3: Enquiry flow, cart, search, customer flow**

Submit a storefront enquiry (unchanged), exercise cart, search, and customer browsing. None touch the modified files except shared `log.ts` (imported only by worker + create-order).

- [ ] **Step 4: Build + type-check gate**

```bash
npx tsc --noEmit
npm run build
```

Expected: both pass. Record regression results in findings and commit.

---

## Task 9: Production Rollout Checklist + Definition of Done

**Files:** none.

- [ ] **Step 1: Confirm production secrets present and correct**

`NOTIFICATIONS_ENABLED=true`, `ENVIRONMENT=production`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` (verified), `MAILGUN_FROM` (on verified domain), `MAILGUN_BASE_URL` (region-correct), `ADMIN_EMAIL`, `ADMIN_URL`, `WORKER_SECRET` (== `app.worker_secret` GUC).

- [ ] **Step 2: Confirm cron is live and returning 200**

`net._http_response` most-recent row `status_code=200`; `cron.job_run_details` recent `status='succeeded'`.

- [ ] **Step 3: End-to-end production proof (Definition of Done)**

Place one authorized real order. Confirm ALL of:
- [ ] `notification_jobs` has customer + admin rows (`enqueue` success logged, correlation_id present)
- [ ] worker log shows `provider_request_success` for both, real Mailgun ids
- [ ] Mailgun logs show `delivered` for both customer and admin
- [ ] both inboxes received the email
- [ ] idempotency proven (Task 7 Step 3), retry/DEAD proven (Task 7 Step 2)
- [ ] regression pass green (Task 8)
- [ ] `docs/superpowers/evidence/2026-07-02-findings.md` contains all evidence

- [ ] **Step 4: Final commit / PR**

```bash
git add docs/superpowers/evidence/2026-07-02-findings.md
git commit -m "docs(notifications): email pipeline verified end-to-end in production"
```

Open the PR from `feat/admin-create-order-cors-fix` (or a fresh branch) summarizing root cause, fix, and the end-to-end evidence.

---

## Self-Review

**Spec coverage (Phases per original directive):**
- Phase 1 (investigation) — completed pre-plan (flow diagram + file map in this doc's header/architecture).
- Phase 2 (root cause) — Task 1 (capture) + Task 2 (decoder), evidence-gated.
- Phase 3 (email pipeline validation) — Task 7 TEST 1 + Task 9 Step 3.
- Phase 5 (surgical fix) — Tasks 3/4/5, each gated, smallest change.
- Phase 6 (observability) — Task 6, exact event names + required fields.
- Phase 7 (test matrix) — Task 7 (email tests 1/2/5/6; WhatsApp 3/4/7 → Plan B).
- Phase 8 (regression) — Task 8.
- Definition of Done (email portion) — Task 9.

**Out of scope (correctly excluded):** WhatsApp automation (Plan B); `enquiry-notify`/`order-status-notify` RPC-vs-upsert ENUM inconsistency (related but not the order-confirmation blocker — noted for a follow-up, not fixed here to preserve minimal scope).

**Placeholder scan:** `<authorized-test-inbox>`, `<WORKER_SECRET>`, `<verified-domain>`, `<STRONG_SECRET>` are deliberate operator-supplied values, not code placeholders.

**Type consistency:** `logNotification(service, fields)` / `buildLogLine(service, fields)` used identically in Task 6 Steps 1,3,5,6. `NotificationLogFields.event` union matches the six Global-Constraints event names.
