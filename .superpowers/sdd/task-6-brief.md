# Task 6 Brief — Phase 6 Observability (Structured Logging)

**Plan:** docs/superpowers/plans/2026-07-02-email-notification-stabilization.md § Task 6

**Scope:** Unconditional. Add Phase-6 structured JSON logging (exact event names + required fields + correlation_id).

**Files to create/modify:**
- Create: `supabase/functions/_shared/log.ts` (logger module)
- Create: `supabase/functions/_shared/log.test.ts` (Deno test)
- Modify: `supabase/functions/notification-worker/index.ts` (emit provider_request_* events)
- Modify: `supabase/functions/create-order/index.ts` (emit notification_enqueue_* events)

---

## Step 1: Create `supabase/functions/_shared/log.ts`

Export the logger module (from plan Task 6, Step 3):

```typescript
// Shared structured logger for the notification pipeline (Phase 6).
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

---

## Step 2: Create `supabase/functions/_shared/log.test.ts`

Deno test proving all required fields always present:

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

Run: `deno test supabase/functions/_shared/log.test.ts` — should PASS (1 test).

---

## Step 3: Wire notification-worker to emit provider_request_* events

In `supabase/functions/notification-worker/index.ts`:

**Add import (after line 4):**
```typescript
import { logNotification } from '../_shared/log.ts';
```

**Replace the per-job send block (lines 77–104)** with (from plan Task 6, Step 5):

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

---

## Step 4: Wire create-order to emit notification_enqueue_* events

In `supabase/functions/create-order/index.ts`:

**Add import (after line 1):**
```typescript
import { logNotification } from '../_shared/log.ts';
```

**In the enqueue block (lines 210–296), add `correlationId: requestId` to both payloads:**

```typescript
        const customerPayload = {
          correlationId: requestId,
          customerName: body.customer.name,
          orderNumber:  data.order_number,
          items:        body.items.map((i: OrderItem) => ({ name: i.name, quantity: i.quantity })),
          total:        Number(data.total),
        };
        const adminPayload = {
          correlationId: requestId,
          customerName:  body.customer.name,
          customerEmail: body.customer.email,
          customerPhone: body.customer.phone ?? null,
          orderNumber:   data.order_number,
          total:         Number(data.total),
          adminOrderUrl: `${adminUrl}/orders/${data.order_id}`,
        };
```

**Before the customer upsert, add (from plan Task 6, Step 5):**

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
```

**In the customer upsert `.then(({ error }) => { ... })` handler:**

```typescript
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

**Mirror the same for admin notification upsert** (same pattern, `ORDER_CONFIRMATION_ADMIN` type).

---

## Step 5: Type-check

```bash
deno check supabase/functions/notification-worker/index.ts
deno check supabase/functions/create-order/index.ts
```

Expected: no errors.

---

## Step 6: Deploy and commit

```bash
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
supabase functions deploy create-order --project-ref hjhqemsyufsifmgespur

git add supabase/functions/_shared/log.ts supabase/functions/_shared/log.test.ts \
        supabase/functions/notification-worker/index.ts supabase/functions/create-order/index.ts

git commit -m "feat(notifications): add Phase-6 structured logging with correlation ids"
```

---

## Report File

`.superpowers/sdd/task-6-report.md`

Report template (fill in after implementation):

```markdown
# Task 6 Report — Phase 6 Observability Logging

## Files Created/Modified

- [x] Created: supabase/functions/_shared/log.ts
- [x] Created: supabase/functions/_shared/log.test.ts (1 test, PASSED)
- [x] Modified: supabase/functions/notification-worker/index.ts (added provider_request_* events)
- [x] Modified: supabase/functions/create-order/index.ts (added notification_enqueue_* events)

## Test Results

```
deno test supabase/functions/_shared/log.test.ts
--- output ---
```

## Type Check Results

```
deno check supabase/functions/notification-worker/index.ts
deno check supabase/functions/create-order/index.ts
--- output ---
```

## Deployment

```
supabase functions deploy notification-worker
supabase functions deploy create-order
--- output ---
```

## Verification

Sample log line from worker (should contain all required fields + event):
```json
{
  "order_id": "abc123",
  "order_number": "ORD-001",
  "customer_email": "test@example.com",
  "notification_type": "ORDER_CONFIRMATION_CUSTOMER",
  "provider": "mailgun",
  "provider_message_id": "20260702...@mailgun.org",
  "correlation_id": "req-uuid",
  "event": "provider_request_success",
  "service": "notification-worker",
  "environment": "production",
  "ts": "2026-07-02T11:30:00Z"
}
```

## Commit

commit: [hash]
```

---

## Do Not

- Change any queue/worker logic
- Add/remove logging elsewhere
- Modify email-templates, mailgun-provider
- Skip the Deno test

## Questions?

Ask before starting implementation.
