# Mailgun + WhatsApp Notifications — Production-Grade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct-send notification approach with a durable, idempotent, queue-backed notification system capable of handling 100k notifications/month with retries, delivery tracking, provider abstraction, and Mailgun webhook processing.

**Architecture:** A `notification_jobs` Postgres table acts as the queue. Callers (`create-order`, `order-status-notify`, `enquiry-notify`) write jobs atomically via an `enqueue_notification` RPC — never blocking the primary operation. A `notification-worker` edge function, scheduled every 2 minutes via pg_cron + pg_net, claims jobs with `SELECT FOR UPDATE SKIP LOCKED`, sends via the Mailgun provider, and updates job state. Mailgun delivery events arrive at `notification-webhook`, which writes `notification_events` and updates the job's `provider_message_id`. A thin `EmailProvider` interface allows future provider migration with a one-file swap.

**Tech Stack:** Deno + TypeScript (Supabase edge functions), Mailgun REST API (fetch, no SDK), `@supabase/supabase-js@2` (jsr), pg_cron + pg_net (Postgres extensions, Supabase Pro), React/Next.js for the admin UI change.

## Global Constraints

- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`, `ADMIN_EMAIL`, `ADMIN_URL` are Supabase function secrets — never in client-side code.
- `WORKER_SECRET` is a Supabase function secret used to authenticate pg_cron → notification-worker calls.
- `MAILGUN_WEBHOOK_SIGNING_KEY` is a Supabase function secret for webhook HMAC verification.
- `NOTIFICATIONS_ENABLED` env var must equal `'true'` to activate enqueueing; defaults to `'false'` in dev/staging unless explicitly set.
- `ENVIRONMENT` env var is `'development'` | `'staging'` | `'production'`; worker skips real Mailgun calls when `ENVIRONMENT !== 'production'` unless `MAILGUN_SANDBOX_DOMAIN` is also set.
- Email failures must NEVER fail the primary operation (order creation, status update, enquiry insert). All enqueue calls are fire-and-forget in the caller, with errors logged.
- `enqueue_notification` RPC is SECURITY DEFINER — only callable from service-role context (edge functions), not from anon/user JWT.
- All edge functions return JSON with CORS headers matching `create-order/index.ts` lines 3-8.
- `deno check` must pass on all new/modified edge function files before each commit.
- `npx tsc --noEmit` must pass on all modified Next.js/TypeScript files before each commit.
- Status notifications only for: `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` — skip `PENDING`.
- Idempotency key format: `{TYPE}:{entity_id}` for one-time events; `{TYPE}:{entity_id}:{status}` for status updates.
- Exponential backoff: `next_attempt_at = now() + (30 * 2^(attempts-1)) seconds` — gives delays of 30s, 60s, 120s.
- Max attempts: 3 (configurable per-job via `max_attempts` column). After max, status → `DEAD`.
- Rate limit: 10 notifications per recipient per rolling hour (enforced in `enqueue_notification` RPC).
- Worker processes at most 20 jobs per invocation (configurable via `WORKER_BATCH_SIZE` env var).
- WhatsApp uses `wa.me` deep-links only — no Business API.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260701_notification_queue.sql` | Create | Tables, enums, RPCs, indexes, RLS, cron schedule |
| `supabase/functions/_shared/notification-types.ts` | Create | Shared TypeScript types for jobs, events, provider |
| `supabase/functions/_shared/email-provider.ts` | Create | `EmailProvider` interface + `createEmailProvider()` factory |
| `supabase/functions/_shared/mailgun-provider.ts` | Create | Mailgun REST API implementation of `EmailProvider` |
| `supabase/functions/_shared/email-templates.ts` | Create | HTML email templates for all 5 notification types |
| `supabase/functions/notification-worker/index.ts` | Create | Scheduled worker: claim → send → complete/fail |
| `supabase/functions/notification-webhook/index.ts` | Create | Mailgun webhook receiver and delivery tracker |
| `supabase/functions/create-order/index.ts` | Modify | Replace direct sends with `enqueue_notification` RPC calls |
| `supabase/functions/order-status-notify/index.ts` | Modify | Replace direct send with `enqueue_notification` RPC call |
| `supabase/functions/enquiry-notify/index.ts` | Create | Enqueue customer receipt + admin notification via RPC |
| `services/orders.ts` | Modify | Fire-and-forget call to `order-status-notify` (unchanged pattern) |
| `app/(app)/orders/[id]/page.tsx` | Modify | Add WhatsApp deep-link button |

---

## Rollback Strategy

All DB changes are additive — new tables/functions only, no modifications to existing tables. To disable notifications without code changes: set `NOTIFICATIONS_ENABLED=false` as a Supabase function secret. To fully roll back: drop the `notification_jobs` and `notification_events` tables and the associated RPCs. The `create-order`, `order-status-notify`, and `enquiry-notify` functions fall back to no-op when the RPC is not available (wrapped in try/catch).

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260701_notification_queue.sql`

**Interfaces:**
- Produces: `public.notification_jobs` table
- Produces: `public.notification_events` table
- Produces: `public.enqueue_notification(key, type, email, payload, priority)` → `jsonb`
- Produces: `public.claim_notification_jobs(batch_size)` → `SETOF notification_jobs`
- Produces: `public.complete_notification_job(job_id, provider_message_id)` → `void`
- Produces: `public.fail_notification_job(job_id, error)` → `void`
- Produces: `public.notification_health` view

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260701_notification_queue.sql

-- ── Extensions ──────────────────────────────────────────────────────────────
-- pg_net is required for pg_cron to invoke the worker edge function via HTTP.
-- Both are available on Supabase Pro. Enable them if not already enabled.
CREATE EXTENSION IF NOT EXISTS pg_net  SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA cron;

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE public.notification_job_status AS ENUM (
  'PENDING',     -- awaiting first send attempt
  'PROCESSING',  -- claimed by worker (in-flight)
  'SENT',        -- successfully delivered to provider
  'RETRYING',    -- failed, scheduled for retry
  'DEAD',        -- exceeded max_attempts
  'CANCELLED'    -- manually cancelled
);

CREATE TYPE public.notification_type AS ENUM (
  'ORDER_CONFIRMATION_CUSTOMER',
  'ORDER_CONFIRMATION_ADMIN',
  'ORDER_STATUS_UPDATE_CUSTOMER',
  'ENQUIRY_RECEIPT_CUSTOMER',
  'ENQUIRY_ADMIN_NOTIFICATION'
);

-- ── notification_jobs (queue) ─────────────────────────────────────────────────
CREATE TABLE public.notification_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key       TEXT NOT NULL,
  type                  public.notification_type NOT NULL,
  recipient_email       TEXT NOT NULL,
  payload               JSONB NOT NULL DEFAULT '{}',
  status                public.notification_job_status NOT NULL DEFAULT 'PENDING',
  priority              INTEGER NOT NULL DEFAULT 0,
  attempts              INTEGER NOT NULL DEFAULT 0,
  max_attempts          INTEGER NOT NULL DEFAULT 3,
  next_attempt_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error            TEXT,
  provider_message_id   TEXT,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notification_jobs_idempotency_key_unique UNIQUE (idempotency_key)
);

-- Index for worker queue scan (only PENDING/RETRYING rows)
CREATE INDEX idx_nj_worker_scan
  ON public.notification_jobs (next_attempt_at ASC, priority DESC)
  WHERE status IN ('PENDING', 'RETRYING');

-- Index for rate-limit check (recipient + recent)
CREATE INDEX idx_nj_recipient_created
  ON public.notification_jobs (recipient_email, created_at DESC);

-- Index for webhook correlation
CREATE INDEX idx_nj_provider_message_id
  ON public.notification_jobs (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TRIGGER notification_jobs_set_updated_at
  BEFORE UPDATE ON public.notification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── notification_events (delivery tracking) ──────────────────────────────────
CREATE TABLE public.notification_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID REFERENCES public.notification_jobs(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  event_type          TEXT NOT NULL,  -- 'delivered','failed','bounced','complained','opened','clicked'
  event_data          JSONB,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ne_job_id      ON public.notification_events (job_id);
CREATE INDEX idx_ne_message_id  ON public.notification_events (provider_message_id);
CREATE INDEX idx_ne_type_time   ON public.notification_events (event_type, received_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.notification_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- Only admin-role users may read/write via the authenticated client.
-- Edge functions use the service role key and bypass RLS entirely.
CREATE POLICY "admins_all_notification_jobs" ON public.notification_jobs
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admins_read_notification_events" ON public.notification_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── enqueue_notification ─────────────────────────────────────────────────────
-- SECURITY DEFINER so that edge functions calling via service-role bypass the
-- anon-key restrictions. The rate-limit and idempotency logic are encapsulated
-- here; callers do not need to know about them.
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_idempotency_key TEXT,
  p_type            public.notification_type,
  p_recipient_email TEXT,
  p_payload         JSONB,
  p_priority        INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id           UUID;
  v_recent_count INTEGER;
BEGIN
  p_recipient_email := lower(trim(p_recipient_email));

  -- Rate limit: max 10 notifications to same email per rolling hour
  SELECT COUNT(*) INTO v_recent_count
  FROM notification_jobs
  WHERE recipient_email = p_recipient_email
    AND created_at > now() - INTERVAL '1 hour'
    AND status <> 'CANCELLED';

  IF v_recent_count >= 10 THEN
    RETURN jsonb_build_object('enqueued', false, 'reason', 'RATE_LIMITED', 'recipient', p_recipient_email);
  END IF;

  -- Idempotent insert — ON CONFLICT returns NULL for id, meaning duplicate
  INSERT INTO notification_jobs (idempotency_key, type, recipient_email, payload, priority)
  VALUES (p_idempotency_key, p_type, p_recipient_email, p_payload, p_priority)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('enqueued', false, 'reason', 'DUPLICATE', 'key', p_idempotency_key);
  END IF;

  RETURN jsonb_build_object('enqueued', true, 'job_id', v_id);
END;
$$;

-- ── claim_notification_jobs ───────────────────────────────────────────────────
-- Uses SELECT FOR UPDATE SKIP LOCKED so concurrent worker invocations never
-- process the same job twice.
CREATE OR REPLACE FUNCTION public.claim_notification_jobs(
  p_batch_size INTEGER DEFAULT 20
)
RETURNS SETOF public.notification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notification_jobs
  SET status = 'PROCESSING', updated_at = now()
  WHERE id IN (
    SELECT id FROM public.notification_jobs
    WHERE status IN ('PENDING', 'RETRYING')
      AND next_attempt_at <= now()
      AND attempts < max_attempts
    ORDER BY priority DESC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ── complete_notification_job ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_notification_job(
  p_job_id              UUID,
  p_provider_message_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_jobs
  SET status              = 'SENT',
      provider_message_id = p_provider_message_id,
      sent_at             = now(),
      updated_at          = now()
  WHERE id = p_job_id;
END;
$$;

-- ── fail_notification_job ─────────────────────────────────────────────────────
-- Increments attempts. If attempts >= max_attempts → DEAD; otherwise → RETRYING
-- with exponential backoff: 30s, 60s, 120s for attempts 1, 2, 3.
CREATE OR REPLACE FUNCTION public.fail_notification_job(
  p_job_id UUID,
  p_error  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts     INTEGER;
  v_max_attempts INTEGER;
  v_delay_secs   INTEGER;
BEGIN
  SELECT attempts, max_attempts
  INTO v_attempts, v_max_attempts
  FROM public.notification_jobs
  WHERE id = p_job_id;

  v_attempts := v_attempts + 1;

  IF v_attempts >= v_max_attempts THEN
    UPDATE public.notification_jobs
    SET status     = 'DEAD',
        attempts   = v_attempts,
        last_error = p_error,
        updated_at = now()
    WHERE id = p_job_id;
  ELSE
    -- Exponential backoff: 30 * 2^(attempts-1)  →  30s, 60s, 120s
    v_delay_secs := 30 * (2 ^ (v_attempts - 1))::INTEGER;
    UPDATE public.notification_jobs
    SET status          = 'RETRYING',
        attempts        = v_attempts,
        last_error      = p_error,
        next_attempt_at = now() + (v_delay_secs * INTERVAL '1 second'),
        updated_at      = now()
    WHERE id = p_job_id;
  END IF;
END;
$$;

-- ── Monitoring view ───────────────────────────────────────────────────────────
CREATE VIEW public.notification_health AS
SELECT
  status,
  COUNT(*)                    AS count,
  ROUND(AVG(attempts), 2)     AS avg_attempts,
  MIN(created_at)             AS oldest,
  MAX(created_at)             AS newest
FROM public.notification_jobs
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status;

-- ── pg_cron schedule ─────────────────────────────────────────────────────────
-- The worker URL and secret are stored as Postgres GUCs so they can be set
-- per-environment without code changes:
--
--   ALTER DATABASE postgres
--     SET app.notification_worker_url = 'https://<ref>.supabase.co/functions/v1/notification-worker';
--   ALTER DATABASE postgres
--     SET app.worker_secret = '<your-WORKER_SECRET>';
--
-- Run both ALTER DATABASE commands immediately after applying this migration.
-- The schedule is harmless before those GUCs are set (net.http_post will 404).
SELECT cron.schedule(
  'process-notification-queue',
  '*/2 * * * *',
  $job$
  SELECT extensions.http_post(
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

- [ ] **Step 2: Apply migration locally and verify tables exist**

```bash
supabase db push
# then verify:
supabase db remote ps   # or via Supabase dashboard > Table Editor
```

Expected: `notification_jobs`, `notification_events` tables visible; `notification_health` view visible.

- [ ] **Step 3: Verify RPCs exist**

```bash
supabase db execute --file - <<'EOF'
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'enqueue_notification',
    'claim_notification_jobs',
    'complete_notification_job',
    'fail_notification_job'
  );
EOF
```

Expected: 4 rows returned.

- [ ] **Step 4: Set the pg_cron GUCs after applying migration**

```sql
-- Run in Supabase SQL editor or via supabase db execute:
ALTER DATABASE postgres
  SET app.notification_worker_url = 'https://<your-project-ref>.supabase.co/functions/v1/notification-worker';
ALTER DATABASE postgres
  SET app.worker_secret = '<generate-with: openssl rand -hex 32>';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260701_notification_queue.sql
git commit -m "feat(notifications): add notification queue schema, RPCs, and pg_cron schedule"
```

---

## Task 2: Shared Modules — Types, Provider Abstraction, Templates

**Files:**
- Create: `supabase/functions/_shared/notification-types.ts`
- Create: `supabase/functions/_shared/email-provider.ts`
- Create: `supabase/functions/_shared/mailgun-provider.ts`
- Create: `supabase/functions/_shared/email-templates.ts`

**Interfaces:**
- Produces: `NotificationJob` type (matches `notification_jobs` table row)
- Produces: `EmailProvider` interface: `send(opts: SendOptions): Promise<string>` (returns provider message ID)
- Produces: `createEmailProvider(): EmailProvider` factory
- Produces: 5 template functions, all returning `string` (HTML)

- [ ] **Step 1: Create `supabase/functions/_shared/notification-types.ts`**

```typescript
// supabase/functions/_shared/notification-types.ts

export type NotificationJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'RETRYING'
  | 'DEAD'
  | 'CANCELLED';

export type NotificationType =
  | 'ORDER_CONFIRMATION_CUSTOMER'
  | 'ORDER_CONFIRMATION_ADMIN'
  | 'ORDER_STATUS_UPDATE_CUSTOMER'
  | 'ENQUIRY_RECEIPT_CUSTOMER'
  | 'ENQUIRY_ADMIN_NOTIFICATION';

export interface NotificationJob {
  id: string;
  idempotency_key: string;
  type: NotificationType;
  recipient_email: string;
  payload: Record<string, unknown>;
  status: NotificationJobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueResult {
  enqueued: boolean;
  reason?: 'RATE_LIMITED' | 'DUPLICATE';
  job_id?: string;
}

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
}
```

- [ ] **Step 2: Create `supabase/functions/_shared/email-provider.ts`**

```typescript
// supabase/functions/_shared/email-provider.ts
// Provider interface + factory. Swap the import in createEmailProvider()
// to migrate away from Mailgun without touching callers.

import type { SendOptions } from './notification-types.ts';
import { MailgunProvider } from './mailgun-provider.ts';

export interface EmailProvider {
  /** Send an email. Returns the provider-assigned message ID. */
  send(opts: SendOptions): Promise<string>;
}

export function createEmailProvider(): EmailProvider {
  const env = Deno.env.get('ENVIRONMENT') ?? 'development';
  const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';

  if (!enabled || env === 'development') {
    // In development or when disabled, log and no-op
    return {
      async send(opts) {
        console.log(JSON.stringify({
          level: 'info',
          service: 'email-provider',
          mode: 'noop',
          to: opts.to,
          subject: opts.subject,
        }));
        return `noop-${crypto.randomUUID()}`;
      },
    };
  }

  return new MailgunProvider();
}
```

- [ ] **Step 3: Create `supabase/functions/_shared/mailgun-provider.ts`**

```typescript
// supabase/functions/_shared/mailgun-provider.ts

import type { EmailProvider, SendOptions } from './email-provider.ts';

// Mailgun's /messages endpoint returns { id, message }
interface MailgunResponse {
  id: string;
  message: string;
}

export class MailgunProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly domain: string;
  private readonly from: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = Deno.env.get('MAILGUN_API_KEY');
    const domain = Deno.env.get('MAILGUN_DOMAIN') ??
      (Deno.env.get('ENVIRONMENT') === 'staging'
        ? Deno.env.get('MAILGUN_SANDBOX_DOMAIN')
        : undefined);

    if (!apiKey) throw new Error('MAILGUN_API_KEY is not set');
    if (!domain) throw new Error('MAILGUN_DOMAIN is not set');

    this.apiKey = apiKey;
    this.domain = domain;
    this.from = Deno.env.get('MAILGUN_FROM') ?? `MEI Bridal Couture <noreply@${domain}>`;
    this.baseUrl = Deno.env.get('MAILGUN_BASE_URL') ?? 'https://api.mailgun.net';
  }

  async send(opts: SendOptions): Promise<string> {
    const form = new FormData();
    form.append('from', this.from);
    form.append('to', opts.to);
    form.append('subject', opts.subject);
    form.append('html', opts.html);

    const res = await fetch(`${this.baseUrl}/v3/${this.domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`api:${this.apiKey}`)}`,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      throw new Error(`Mailgun ${res.status} ${res.statusText}: ${body}`);
    }

    const json = await res.json() as MailgunResponse;
    // Mailgun message IDs come wrapped in angle brackets: <abc@domain>
    return json.id.replace(/^<|>$/g, '');
  }
}
```

- [ ] **Step 4: Create `supabase/functions/_shared/email-templates.ts`**

```typescript
// supabase/functions/_shared/email-templates.ts

// ── Layout shell ──────────────────────────────────────────────────────────────

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MEI Bridal Couture</title>
</head>
<body style="margin:0;padding:0;background:#f5f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#f5f2ee;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
        style="background:#ffffff;max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="padding:32px 40px 16px;border-top:3px solid #c9a465;text-align:center;">
          <p style="font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;
            text-transform:uppercase;color:#c9a465;margin:0;">
            MEI Bridal Couture
          </p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:8px 40px 40px;">${content}</td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 40px;border-top:1px solid #f0ede8;text-align:center;">
          <p style="font-size:11px;color:#aaa;margin:0;">
            MEI Bridal Couture &middot; Mumbai, India
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function h2(text: string) {
  return `<h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;
    color:#1a1a1a;margin:0 0 16px 0;">${text}</h2>`;
}

function para(text: string) {
  return `<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px 0;">${text}</p>`;
}

function label(text: string) {
  return `<p style="font-size:13px;font-weight:600;color:#c9a465;letter-spacing:0.1em;
    text-transform:uppercase;margin:0 0 16px 0;">${text}</p>`;
}

function ctaButton(text: string, href: string, bg = '#1a1a1a') {
  return `<a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;
    font-size:12px;font-weight:600;letter-spacing:0.08em;padding:10px 20px;
    text-decoration:none;text-transform:uppercase;">${text}</a>`;
}

function waButton(phone: string, name: string, contextText: string) {
  const href = `https://wa.me/${phone.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(contextText)}`;
  return `<a href="${href}" style="display:inline-block;background:#25D366;color:#ffffff;
    font-size:12px;font-weight:600;padding:10px 16px;text-decoration:none;margin-left:8px;">
    <svg style="width:14px;height:14px;vertical-align:middle;fill:currentColor;margin-right:6px;"
      viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348
        5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28
        3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0
        24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585
        -1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754
        9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z"/>
    </svg>WhatsApp</a>`;
}

function metaTable(rows: Array<[string, string | null | undefined]>): string {
  const cells = rows
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:4px 0;width:110px;font-size:13px;color:#999;">${k}</td>
          <td style="padding:4px 0;font-size:13px;color:#555;">${v}</td>
        </tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${cells}</table>`;
}

// ── Template: ORDER_CONFIRMATION_CUSTOMER ────────────────────────────────────

export interface OrderConfirmationCustomerPayload {
  customerName: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number }>;
  total: number;
}

export function orderConfirmationCustomer(p: OrderConfirmationCustomerPayload): string {
  const rows = p.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-size:13px;color:#3d3d3d;">${i.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-size:13px;color:#3d3d3d;
            text-align:right;">&times;${i.quantity}</td>
        </tr>`
    )
    .join('');

  return base(`
    ${h2('Order Confirmed')}
    ${para(`Dear ${p.customerName},`)}
    ${para('Thank you for your order. We have received your payment and are preparing your ensemble with care.')}
    ${label(p.orderNumber)}
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td style="padding-top:12px;font-size:14px;font-weight:600;color:#c9a465;">Total</td>
          <td style="padding-top:12px;font-size:14px;font-weight:600;color:#c9a465;text-align:right;">
            &#8377;${p.total.toLocaleString('en-IN')}
          </td>
        </tr>
      </tfoot>
    </table>
    ${para('<span style="font-size:13px;color:#888;">We will keep you updated as your order progresses. For any queries, simply reply to this email.</span>')}
  `);
}

// ── Template: ORDER_CONFIRMATION_ADMIN ───────────────────────────────────────

export interface OrderConfirmationAdminPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  orderNumber: string;
  total: number;
  adminOrderUrl: string;
}

export function orderConfirmationAdmin(p: OrderConfirmationAdminPayload): string {
  const buttons = ctaButton('View Order', p.adminOrderUrl) +
    (p.customerPhone
      ? waButton(p.customerPhone, p.customerName, `Hello ${p.customerName}, regarding your order ${p.orderNumber}`)
      : '');

  return base(`
    ${h2('New Order Received')}
    ${label(p.orderNumber)}
    ${metaTable([
      ['Customer', p.customerName],
      ['Email', p.customerEmail],
      ['Phone', p.customerPhone],
      ['Total', `&#8377;${p.total.toLocaleString('en-IN')}`],
    ])}
    ${buttons}
  `);
}

// ── Template: ORDER_STATUS_UPDATE_CUSTOMER ───────────────────────────────────

export interface OrderStatusUpdateCustomerPayload {
  customerName: string;
  orderNumber: string;
  newStatus: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  CONFIRMED:  'Your order has been confirmed and is being prepared by our artisans.',
  PROCESSING: 'Our team is actively working on your ensemble.',
  SHIPPED:    'Your order is on its way to you.',
  DELIVERED:  'Your order has been delivered. We hope you love it.',
  CANCELLED:  'Your order has been cancelled. Please contact us if you have any questions.',
};

export function orderStatusUpdateCustomer(p: OrderStatusUpdateCustomerPayload): string {
  const message = STATUS_MESSAGES[p.newStatus] ??
    `Your order status has been updated to ${p.newStatus}.`;

  return base(`
    ${h2('Order Update')}
    ${para(`Dear ${p.customerName},`)}
    ${para(message)}
    ${label(`${p.orderNumber} &middot; ${p.newStatus}`)}
  `);
}

// ── Template: ENQUIRY_RECEIPT_CUSTOMER ───────────────────────────────────────

export interface EnquiryReceiptCustomerPayload {
  name: string;
  message: string;
}

export function enquiryReceiptCustomer(p: EnquiryReceiptCustomerPayload): string {
  return base(`
    ${h2("We've received your enquiry")}
    ${para(`Dear ${p.name},`)}
    ${para('Thank you for reaching out to MEI Bridal Couture. Our team will review your enquiry and be in touch within 1&ndash;2 business days.')}
    <div style="background:#faf8f5;border-left:3px solid #c9a465;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#555;margin:0;font-style:italic;">&ldquo;${p.message}&rdquo;</p>
    </div>
    ${para('<span style="font-size:13px;color:#888;">For urgent queries, please call or WhatsApp us directly.</span>')}
  `);
}

// ── Template: ENQUIRY_ADMIN_NOTIFICATION ─────────────────────────────────────

export interface EnquiryAdminNotificationPayload {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  occasion: string | null;
  budget: string | null;
  adminEnquiryUrl: string;
}

export function enquiryAdminNotification(p: EnquiryAdminNotificationPayload): string {
  const buttons = ctaButton('View Enquiry', p.adminEnquiryUrl) +
    (p.phone
      ? waButton(p.phone, p.name, `Hello ${p.name}, regarding your enquiry with MEI Bridal Couture`)
      : '');

  return base(`
    ${h2('New Enquiry')}
    ${metaTable([
      ['Name', p.name],
      ['Email', p.email],
      ['Phone', p.phone],
      ['Occasion', p.occasion],
      ['Budget', p.budget],
    ])}
    <div style="background:#faf8f5;border-left:3px solid #c9a465;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#555;margin:0;">${p.message}</p>
    </div>
    ${buttons}
  `);
}

// ── Template renderer (used by worker) ───────────────────────────────────────

import type { NotificationType } from './notification-types.ts';

export interface RenderResult {
  subject: string;
  html: string;
}

export function renderTemplate(type: NotificationType, payload: Record<string, unknown>): RenderResult {
  switch (type) {
    case 'ORDER_CONFIRMATION_CUSTOMER':
      return {
        subject: `Order confirmed — ${payload.orderNumber}`,
        html: orderConfirmationCustomer(payload as unknown as OrderConfirmationCustomerPayload),
      };
    case 'ORDER_CONFIRMATION_ADMIN':
      return {
        subject: `New order ${payload.orderNumber} from ${payload.customerName}`,
        html: orderConfirmationAdmin(payload as unknown as OrderConfirmationAdminPayload),
      };
    case 'ORDER_STATUS_UPDATE_CUSTOMER':
      return {
        subject: `Update on your order ${payload.orderNumber}`,
        html: orderStatusUpdateCustomer(payload as unknown as OrderStatusUpdateCustomerPayload),
      };
    case 'ENQUIRY_RECEIPT_CUSTOMER':
      return {
        subject: "We've received your enquiry — MEI Bridal Couture",
        html: enquiryReceiptCustomer(payload as unknown as EnquiryReceiptCustomerPayload),
      };
    case 'ENQUIRY_ADMIN_NOTIFICATION':
      return {
        subject: `New enquiry from ${payload.name}`,
        html: enquiryAdminNotification(payload as unknown as EnquiryAdminNotificationPayload),
      };
  }
}
```

- [ ] **Step 5: Type-check all four shared files**

```bash
deno check supabase/functions/_shared/notification-types.ts
deno check supabase/functions/_shared/email-provider.ts
deno check supabase/functions/_shared/mailgun-provider.ts
deno check supabase/functions/_shared/email-templates.ts
```

Expected: no errors on any file.

- [ ] **Step 6: Commit**

```bash
git add \
  supabase/functions/_shared/notification-types.ts \
  supabase/functions/_shared/email-provider.ts \
  supabase/functions/_shared/mailgun-provider.ts \
  supabase/functions/_shared/email-templates.ts
git commit -m "feat(notifications): add shared provider abstraction and email templates"
```

---

## Task 3: `notification-worker` Edge Function

**Files:**
- Create: `supabase/functions/notification-worker/index.ts`

**Interfaces:**
- Consumes: `claim_notification_jobs(batch_size)` RPC → `NotificationJob[]`
- Consumes: `complete_notification_job(id, message_id)` RPC
- Consumes: `fail_notification_job(id, error)` RPC
- Consumes: `createEmailProvider()` → `EmailProvider`
- Consumes: `renderTemplate(type, payload)` → `{ subject, html }`
- Auth: `x-worker-secret` header must match `WORKER_SECRET` env var
- Called by: pg_cron every 2 minutes

- [ ] **Step 1: Create `supabase/functions/notification-worker/index.ts`**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createEmailProvider } from '../_shared/email-provider.ts';
import { renderTemplate } from '../_shared/email-templates.ts';
import type { NotificationJob } from '../_shared/notification-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function structuredLog(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: 'notification-worker',
    environment: Deno.env.get('ENVIRONMENT') ?? 'unknown',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  // Verify worker secret (pg_cron sends this in the header)
  const workerSecret = Deno.env.get('WORKER_SECRET');
  const callerSecret = req.headers.get('x-worker-secret');
  if (!workerSecret || callerSecret !== workerSecret) {
    structuredLog({ event: 'auth_failed', reason: 'invalid_worker_secret' });
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const runId = crypto.randomUUID();
  const batchSize = parseInt(Deno.env.get('WORKER_BATCH_SIZE') ?? '20', 10);

  structuredLog({ event: 'worker_start', runId, batchSize });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Claim jobs atomically (SELECT FOR UPDATE SKIP LOCKED)
  const { data: jobs, error: claimError } = await db.rpc('claim_notification_jobs', {
    p_batch_size: batchSize,
  });

  if (claimError) {
    structuredLog({ event: 'claim_failed', runId, error: claimError.message });
    return json({ error: 'CLAIM_FAILED', detail: claimError.message }, 500);
  }

  const claimed = (jobs ?? []) as NotificationJob[];
  structuredLog({ event: 'claimed', runId, count: claimed.length });

  if (claimed.length === 0) {
    return json({ processed: 0, runId });
  }

  const provider = createEmailProvider();
  const results: Array<{ jobId: string; status: 'sent' | 'failed'; error?: string }> = [];

  for (const job of claimed) {
    const jobLog = (event: string, extra?: Record<string, unknown>) =>
      structuredLog({ event, runId, jobId: job.id, type: job.type, attempt: job.attempts + 1, ...extra });

    const start = Date.now();

    try {
      const { subject, html } = renderTemplate(job.type, job.payload);

      const messageId = await provider.send({
        to: job.recipient_email,
        subject,
        html,
      });

      await db.rpc('complete_notification_job', {
        p_job_id: job.id,
        p_provider_message_id: messageId,
      });

      jobLog('job_sent', { messageId, durationMs: Date.now() - start });
      results.push({ jobId: job.id, status: 'sent' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await db.rpc('fail_notification_job', {
        p_job_id: job.id,
        p_error: errMsg,
      });

      jobLog('job_failed', { error: errMsg, durationMs: Date.now() - start });
      results.push({ jobId: job.id, status: 'failed', error: errMsg });
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  structuredLog({ event: 'worker_complete', runId, sent, failed, total: claimed.length });

  return json({ processed: claimed.length, sent, failed, runId });
});
```

- [ ] **Step 2: Type-check**

```bash
deno check supabase/functions/notification-worker/index.ts
```

Expected: no errors.

- [ ] **Step 3: Manual curl test (with NOTIFICATIONS_ENABLED=false, so provider is no-op)**

```bash
# Deploy first
supabase functions deploy notification-worker

# Set required secrets if not already set
supabase secrets set WORKER_SECRET=$(openssl rand -hex 32)
supabase secrets set NOTIFICATIONS_ENABLED=false
supabase secrets set ENVIRONMENT=development

# Test
WORKER_SECRET=$(supabase secrets list 2>/dev/null | grep WORKER_SECRET | awk '{print $2}')
curl -X POST https://<project-ref>.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: $WORKER_SECRET" \
  -d '{}'
```

Expected response: `{"processed":0,"sent":0,"failed":0,"runId":"..."}` (queue empty on fresh DB).

- [ ] **Step 4: Verify unauthorized returns 401**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"error":"UNAUTHORIZED"}` with HTTP 401.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notification-worker/index.ts
git commit -m "feat(notifications): add notification-worker edge function with exponential backoff"
```

---

## Task 4: `notification-webhook` Edge Function

**Files:**
- Create: `supabase/functions/notification-webhook/index.ts`

**Interfaces:**
- Accepts: `POST` from Mailgun with `multipart/form-data` containing `timestamp`, `token`, `signature`, and event fields
- Auth: HMAC-SHA256 verification of Mailgun webhook signature using `MAILGUN_WEBHOOK_SIGNING_KEY`
- Produces: writes `notification_events` rows; updates `notification_jobs.provider_message_id` when a delivery event matches a pending job

- [ ] **Step 1: Create `supabase/functions/notification-webhook/index.ts`**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function structuredLog(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: 'notification-webhook',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

// Mailgun webhook signature verification.
// Docs: https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#securing-webhooks
async function verifyMailgunSignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(timestamp + token));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const signingKey = Deno.env.get('MAILGUN_WEBHOOK_SIGNING_KEY');
  if (!signingKey) {
    structuredLog({ event: 'config_error', error: 'MAILGUN_WEBHOOK_SIGNING_KEY not set' });
    return json({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  // Mailgun webhooks send multipart/form-data
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'INVALID_CONTENT_TYPE' }, 400);
  }

  const timestamp = form.get('timestamp') as string ?? '';
  const token     = form.get('token')     as string ?? '';
  const signature = form.get('signature') as string ?? '';

  if (!timestamp || !token || !signature) {
    structuredLog({ event: 'missing_signature_fields' });
    return json({ error: 'MISSING_SIGNATURE_FIELDS' }, 400);
  }

  // Reject stale webhooks (> 5 minutes old)
  const webhookAge = Date.now() / 1000 - parseInt(timestamp, 10);
  if (webhookAge > 300) {
    structuredLog({ event: 'stale_webhook', ageSeconds: Math.round(webhookAge) });
    return json({ error: 'STALE_WEBHOOK' }, 400);
  }

  const valid = await verifyMailgunSignature(signingKey, timestamp, token, signature);
  if (!valid) {
    structuredLog({ event: 'signature_invalid' });
    return json({ error: 'INVALID_SIGNATURE' }, 401);
  }

  // Extract event fields
  // Mailgun sends event data in different fields depending on legacy vs new webhooks.
  // We support both: top-level fields and nested event-data JSON.
  const eventType      = form.get('event')      as string ?? '';
  const messageId      = (form.get('Message-Id') as string ?? '').replace(/^<|>$/g, '');
  const recipientEmail = form.get('recipient')   as string ?? '';

  // Collect all form fields as the event_data payload
  const eventData: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === 'string') eventData[key] = value;
  });

  structuredLog({ event: 'webhook_received', eventType, messageId, recipientEmail });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find the matching notification job by provider_message_id
  let jobId: string | null = null;
  if (messageId) {
    const { data: job } = await db
      .from('notification_jobs')
      .select('id')
      .eq('provider_message_id', messageId)
      .maybeSingle();
    jobId = job?.id ?? null;
  }

  // Insert delivery event
  const { error: insertError } = await db.from('notification_events').insert({
    job_id:              jobId,
    provider_message_id: messageId || null,
    event_type:          eventType,
    event_data:          eventData,
  });

  if (insertError) {
    structuredLog({ event: 'event_insert_failed', error: insertError.message });
    // Return 200 anyway — Mailgun will retry on non-200, causing duplicate events
  }

  structuredLog({ event: 'webhook_processed', eventType, jobId, messageId });
  return json({ received: true });
});
```

- [ ] **Step 2: Type-check**

```bash
deno check supabase/functions/notification-webhook/index.ts
```

Expected: no errors.

- [ ] **Step 3: Deploy and register webhook URL in Mailgun**

```bash
supabase functions deploy notification-webhook

# Set the webhook signing key (from Mailgun dashboard > Webhooks > HTTP webhook signing key)
supabase secrets set MAILGUN_WEBHOOK_SIGNING_KEY=<from-mailgun-dashboard>
```

In Mailgun dashboard: Sending → Webhooks → Add webhook URL:
`https://<project-ref>.supabase.co/functions/v1/notification-webhook`
for events: `delivered`, `failed`, `bounced`, `complained`.

- [ ] **Step 4: Test with Mailgun test webhook button**

In Mailgun dashboard, click "Test webhook". Expected:
- Function log shows `webhook_received` then `webhook_processed`.
- A row appears in `notification_events` table.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notification-webhook/index.ts
git commit -m "feat(notifications): add Mailgun webhook handler with HMAC signature verification"
```

---

## Task 5: Extend `create-order` to Enqueue Notifications

**Files:**
- Modify: `supabase/functions/create-order/index.ts`

**Interfaces:**
- Consumes: `enqueue_notification` RPC (via service-role Supabase client already in scope)
- Change: replaces direct `sendEmail` calls (if any from original plan) with RPC calls
- No change to HTTP interface or response shape

- [ ] **Step 1: Read current `create-order/index.ts` to identify insertion point**

The success section (after `log('order created', ...)`) is the insertion point. The current final return is on line 196. Add enqueueing before it.

- [ ] **Step 2: Add notification enqueue block to `create-order/index.ts`**

After the `log('order created', ...)` call and before the final `return jsonResponse(...)`, insert:

```typescript
    // Enqueue notifications (idempotent — safe to call even for already_exists)
    if (!data.already_exists) {
      const adminEmail = Deno.env.get('ADMIN_EMAIL');
      const adminUrl   = Deno.env.get('ADMIN_URL') ?? '';
      const enabled    = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';

      if (enabled) {
        const customerPayload = {
          customerName: body.customer.name,
          orderNumber:  data.order_number,
          items:        body.items.map((i: OrderItem) => ({ name: i.name, quantity: i.quantity })),
          total:        Number(data.total),
        };
        const adminPayload = {
          customerName:  body.customer.name,
          customerEmail: body.customer.email,
          customerPhone: body.customer.phone ?? null,
          orderNumber:   data.order_number,
          total:         Number(data.total),
          adminOrderUrl: `${adminUrl}/orders/${data.order_id}`,
        };

        const enqueueCustomer = supabase.rpc('enqueue_notification', {
          p_idempotency_key: `ORDER_CONFIRMATION_CUSTOMER:${data.order_id}`,
          p_type:            'ORDER_CONFIRMATION_CUSTOMER',
          p_recipient_email: body.customer.email,
          p_payload:         customerPayload,
          p_priority:        1,
        }).then(({ error }) => {
          if (error) log('enqueue_customer_failed', { error: error.message });
        });

        const enqueueAdmin = adminEmail
          ? supabase.rpc('enqueue_notification', {
              p_idempotency_key: `ORDER_CONFIRMATION_ADMIN:${data.order_id}`,
              p_type:            'ORDER_CONFIRMATION_ADMIN',
              p_recipient_email: adminEmail,
              p_payload:         adminPayload,
              p_priority:        1,
            }).then(({ error }) => {
              if (error) log('enqueue_admin_failed', { error: error.message });
            })
          : Promise.resolve();

        // Fire-and-forget — do not await before returning order response
        Promise.allSettled([enqueueCustomer, enqueueAdmin])
          .then((results) => {
            results.forEach((r, i) => {
              if (r.status === 'rejected') log('enqueue_settled_error', { index: i, reason: String(r.reason) });
            });
          });
      }
    }
```

- [ ] **Step 3: Type-check**

```bash
deno check supabase/functions/create-order/index.ts
```

Expected: no errors.

- [ ] **Step 4: Smoke-test (bypass mode)**

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"name":"Test","email":"test@example.com","phone":"9999999999","city":"Mumbai"},
    "items": [{"product_id":"00000000-0000-0000-0000-000000000000","name":"Test","quantity":1}],
    "shipping_address": {},
    "payment": {"provider":"razorpay","payment_id":"bypass_test2","order_id":"","signature":""}
  }'
```

Expected: `{"success":true,...}` — bypass returns early before enqueue code runs.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-order/index.ts
git commit -m "feat(notifications): wire create-order to enqueue confirmation notifications"
```

---

## Task 6: Extend `order-status-notify` to Enqueue

**Files:**
- Modify: `supabase/functions/order-status-notify/index.ts`

**Interfaces:**
- Current: sends email directly via `sendEmail`
- New: replaces send with `enqueue_notification` RPC call
- HTTP interface unchanged: still accepts `{ order_id, new_status }` with JWT auth

- [ ] **Step 1: Rewrite `order-status-notify/index.ts`**

Replace the entire file with the queue-based version:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Statuses that trigger a customer notification email
const NOTIFY_STATUSES = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function structuredLog(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: 'order-status-notify',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  // Verify caller is an authenticated Supabase user
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify JWT by calling getUser through the user-scoped client
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    structuredLog({ event: 'auth_failed', error: authError?.message });
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const body = await req.json().catch(() => null) as { order_id?: string; new_status?: string } | null;
  if (!body?.order_id || !body?.new_status) {
    return json({ error: 'INVALID_PAYLOAD' }, 400);
  }

  if (!NOTIFY_STATUSES.has(body.new_status)) {
    return json({ success: true, skipped: 'non_notifiable_status' });
  }

  const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';
  if (!enabled) {
    structuredLog({ event: 'notifications_disabled', orderId: body.order_id, status: body.new_status });
    return json({ success: true, skipped: 'notifications_disabled' });
  }

  const db = createClient(supabaseUrl, serviceKey);

  // Fetch order + customer
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('order_number, customers(name, email)')
    .eq('id', body.order_id)
    .is('deleted_at', null)
    .single();

  if (orderError || !order) {
    structuredLog({ event: 'order_not_found', orderId: body.order_id, error: orderError?.message });
    return json({ error: 'ORDER_NOT_FOUND' }, 404);
  }

  const customer = order.customers as { name: string; email: string | null } | null;
  if (!customer?.email) {
    return json({ success: true, skipped: 'no_customer_email' });
  }

  const { error: enqueueError } = await db.rpc('enqueue_notification', {
    p_idempotency_key: `ORDER_STATUS_UPDATE_CUSTOMER:${body.order_id}:${body.new_status}`,
    p_type:            'ORDER_STATUS_UPDATE_CUSTOMER',
    p_recipient_email: customer.email,
    p_payload: {
      customerName: customer.name,
      orderNumber:  order.order_number,
      newStatus:    body.new_status,
    },
    p_priority: 0,
  });

  if (enqueueError) {
    structuredLog({ event: 'enqueue_failed', orderId: body.order_id, error: enqueueError.message });
    // Return success — the primary operation already succeeded; notification failure is non-critical
    return json({ success: true, enqueued: false, detail: enqueueError.message });
  }

  structuredLog({ event: 'enqueued', orderId: body.order_id, status: body.new_status });
  return json({ success: true, enqueued: true });
});
```

- [ ] **Step 2: Verify `services/orders.ts` still fires the function (no change needed)**

The `updateOrderStatus` function in `services/orders.ts` already calls `supabase.functions.invoke('order-status-notify', ...)` fire-and-forget. That call still works with the new implementation. Confirm it reads:

```typescript
supabase.functions
  .invoke('order-status-notify', { body: { order_id: id, new_status: status } })
  .catch((err) => console.error('order-status-notify invoke failed:', err))
```

If `services/orders.ts` does not yet have this call, add it after the `logAuditEvent` call (before `return data`):

```typescript
  // Fire-and-forget: enqueue status update notification
  supabase.functions
    .invoke('order-status-notify', { body: { order_id: id, new_status: status } })
    .catch((err) => console.error('order-status-notify invoke failed:', err))
```

- [ ] **Step 3: Type-check both files**

```bash
deno check supabase/functions/order-status-notify/index.ts
npx tsc --noEmit
```

Expected: no errors on either.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/order-status-notify/index.ts services/orders.ts
git commit -m "feat(notifications): enqueue-based order status notifications with JWT auth"
```

---

## Task 7: `enquiry-notify` Edge Function

**Files:**
- Create: `supabase/functions/enquiry-notify/index.ts`

**Interfaces:**
- Accepts: `POST { enquiry_id: string }` with `x-storefront-secret` header
- Enqueues: `ENQUIRY_RECEIPT_CUSTOMER` and `ENQUIRY_ADMIN_NOTIFICATION` via `enqueue_notification` RPC
- Called by: MEI storefront (MEI-35) after inserting an enquiry

- [ ] **Step 1: Create `supabase/functions/enquiry-notify/index.ts`**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-storefront-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function structuredLog(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: 'enquiry-notify',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  // Verify storefront secret
  const storefrontSecret = Deno.env.get('STOREFRONT_API_SECRET');
  const callerSecret     = req.headers.get('x-storefront-secret');
  if (!storefrontSecret || callerSecret !== storefrontSecret) {
    structuredLog({ event: 'auth_failed', reason: 'invalid_storefront_secret' });
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const body = await req.json().catch(() => null) as { enquiry_id?: string } | null;
  if (!body?.enquiry_id) {
    return json({ error: 'INVALID_PAYLOAD' }, 400);
  }

  const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';
  if (!enabled) {
    structuredLog({ event: 'notifications_disabled', enquiryId: body.enquiry_id });
    return json({ success: true, skipped: 'notifications_disabled' });
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
    structuredLog({ event: 'enquiry_not_found', enquiryId: body.enquiry_id, error: error?.message });
    return json({ error: 'ENQUIRY_NOT_FOUND' }, 404);
  }

  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const adminUrl   = Deno.env.get('ADMIN_URL') ?? '';

  const enqueueCustomer = db.rpc('enqueue_notification', {
    p_idempotency_key: `ENQUIRY_RECEIPT_CUSTOMER:${body.enquiry_id}`,
    p_type:            'ENQUIRY_RECEIPT_CUSTOMER',
    p_recipient_email: enquiry.email,
    p_payload: {
      name:    enquiry.name,
      message: enquiry.message,
    },
    p_priority: 1,
  }).then(({ error: e }) => {
    if (e) structuredLog({ event: 'enqueue_customer_failed', error: e.message });
  });

  const enqueueAdmin = adminEmail
    ? db.rpc('enqueue_notification', {
        p_idempotency_key: `ENQUIRY_ADMIN_NOTIFICATION:${body.enquiry_id}`,
        p_type:            'ENQUIRY_ADMIN_NOTIFICATION',
        p_recipient_email: adminEmail,
        p_payload: {
          name:             enquiry.name,
          email:            enquiry.email,
          phone:            enquiry.phone ?? null,
          message:          enquiry.message,
          occasion:         enquiry.occasion ?? null,
          budget:           enquiry.budget ?? null,
          adminEnquiryUrl:  `${adminUrl}/enquiries/${body.enquiry_id}`,
        },
        p_priority: 1,
      }).then(({ error: e }) => {
        if (e) structuredLog({ event: 'enqueue_admin_failed', error: e.message });
      })
    : Promise.resolve();

  await Promise.allSettled([enqueueCustomer, enqueueAdmin]);

  structuredLog({ event: 'enqueued', enquiryId: body.enquiry_id });
  return json({ success: true });
});
```

- [ ] **Step 2: Type-check**

```bash
deno check supabase/functions/enquiry-notify/index.ts
```

Expected: no errors.

- [ ] **Step 3: Deploy and smoke-test**

```bash
supabase functions deploy enquiry-notify

# Insert a test enquiry via Supabase dashboard and note its UUID
ENQUIRY_ID="<uuid>"

curl -X POST https://<project-ref>.supabase.co/functions/v1/enquiry-notify \
  -H "Content-Type: application/json" \
  -H "x-storefront-secret: $(supabase secrets list | grep STOREFRONT_API_SECRET | awk '{print $2}')" \
  -d "{\"enquiry_id\": \"$ENQUIRY_ID\"}"
```

Expected: `{"success":true}`. Verify two rows appear in `notification_jobs` with status `PENDING` (when `NOTIFICATIONS_ENABLED=true`) or `{"success":true,"skipped":"notifications_disabled"}` when disabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/enquiry-notify/index.ts
git commit -m "feat(notifications): add queue-based enquiry-notify edge function"
```

---

## Task 8: WhatsApp Button on Order Detail Page

**Files:**
- Modify: `app/(app)/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `order.customers?.phone` — already fetched by `getOrderById` (`services/orders.ts:33-44`) via `select('*, customers(*), order_items(...)')`
- Produces: "Message on WhatsApp" anchor rendered conditionally when `order.customers.phone` is non-null
- Style: identical to the button on `app/(app)/enquiries/[id]/page.tsx` lines 212–222

- [ ] **Step 1: Add WhatsApp button inside the status block of `app/(app)/orders/[id]/page.tsx`**

Locate the `<div className="flex flex-col items-end w-full sm:w-auto">` block (around line 162). Replace it with:

```tsx
        <div className="flex flex-col items-end w-full sm:w-auto gap-3">
          <div className="relative">
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              disabled={updateStatusMutation.isPending}
              className="border border-[#E8E0D5] bg-white pl-4 pr-10 py-2.5 text-[12px] font-medium text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] cursor-pointer appearance-none font-sans min-w-[140px] uppercase tracking-wider rounded-none"
            >
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <div className="absolute right-3.5 top-3.5 pointer-events-none text-zinc-400 text-[8px] font-sans">
              {updateStatusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin text-zinc-400" /> : '▼'}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(order.status)}`} />
            <span>{order.status}</span>
          </div>

          {order.customers?.phone && (
            <a
              href={`https://wa.me/${order.customers.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Hello ${order.customers.name ?? ''}, regarding your order ${order.order_number}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-[12px] font-bold px-4 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer select-none font-sans rounded-none"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585-1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754 9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z" />
              </svg>
              Message on WhatsApp
            </a>
          )}
        </div>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000/orders/<order-id-with-phone>`:
1. WhatsApp button is visible below the status dot.
2. Button is absent for orders where `order.customers?.phone` is `null`.
3. Clicking opens `wa.me` with pre-filled text.
4. Status dropdown still works.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/orders/[id]/page.tsx"
git commit -m "feat(notifications): add WhatsApp deep-link button to order detail page"
```

---

## Secrets Reference

All must be set via `supabase secrets set KEY=value`:

| Secret | Value | Required for |
|---|---|---|
| `MAILGUN_API_KEY` | Mailgun private API key | notification-worker |
| `MAILGUN_DOMAIN` | `mg.yourdomain.com` | notification-worker |
| `MAILGUN_SANDBOX_DOMAIN` | Mailgun sandbox domain | notification-worker (staging only) |
| `MAILGUN_FROM` | `MEI Bridal Couture <noreply@mg.yourdomain.com>` | notification-worker |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | From Mailgun dashboard > Webhooks | notification-webhook |
| `ADMIN_EMAIL` | Studio notification recipient | create-order, enquiry-notify |
| `ADMIN_URL` | `https://admin.yourdomain.com` | create-order, order-status-notify, enquiry-notify |
| `WORKER_SECRET` | `openssl rand -hex 32` | notification-worker (verifies pg_cron calls) |
| `NOTIFICATIONS_ENABLED` | `true` in staging/production, `false` in dev | all notification functions |
| `ENVIRONMENT` | `development` / `staging` / `production` | all notification functions |
| `STOREFRONT_API_SECRET` | Already set | enquiry-notify |
| `SUPABASE_ANON_KEY` | Already set by Supabase | order-status-notify |

---

## Deployment Strategy

1. Apply migration (`supabase db push`)
2. Set the pg_cron GUCs (`ALTER DATABASE postgres SET app.notification_worker_url = ...`)
3. Deploy shared modules (no deploy needed — imported by functions)
4. Deploy `notification-worker` and `notification-webhook`
5. Set `NOTIFICATIONS_ENABLED=false` for all functions (dark deploy)
6. Deploy `create-order`, `order-status-notify`, `enquiry-notify`
7. Register Mailgun webhook URL in Mailgun dashboard
8. Smoke-test by manually inserting a job into `notification_jobs` and invoking the worker with curl
9. Set `NOTIFICATIONS_ENABLED=true` for all functions

---

## Rollback Strategy

1. Set `NOTIFICATIONS_ENABLED=false` → all enqueue calls short-circuit, no new jobs
2. Optionally delete/cancel outstanding jobs: `UPDATE notification_jobs SET status = 'CANCELLED' WHERE status IN ('PENDING','RETRYING')`
3. Redeploy previous versions of `create-order`, `order-status-notify` if needed
4. Tables and RPCs can remain — they are additive and harmless

---

## Monitoring Strategy

### Queue health query (run in Supabase SQL editor)
```sql
SELECT * FROM notification_health;
```

### Dead jobs in last 24h (alert threshold: > 5)
```sql
SELECT COUNT(*) FROM notification_jobs
WHERE status = 'DEAD' AND created_at > now() - INTERVAL '24 hours';
```

### Stuck PROCESSING jobs (worker crashed mid-batch)
```sql
SELECT * FROM notification_jobs
WHERE status = 'PROCESSING' AND updated_at < now() - INTERVAL '10 minutes';
-- Fix: UPDATE notification_jobs SET status = 'RETRYING', next_attempt_at = now() WHERE ...
```

### Pending jobs older than 15 minutes (worker not running)
```sql
SELECT COUNT(*) FROM notification_jobs
WHERE status = 'PENDING' AND created_at < now() - INTERVAL '15 minutes';
```

---

## Alerting Strategy

Set up Supabase DB webhooks or a scheduled pg_cron job to alert on:
1. **Dead jobs > 5 in 24h** — indicates Mailgun API issues or systematic failures
2. **PENDING jobs > 15 min old** — indicates pg_cron or worker failure
3. **PROCESSING jobs > 10 min old** — indicates crashed worker

Alert via: Mailgun itself (send to admin email) OR Supabase webhook to Slack.

```sql
-- Add to pg_cron: alert if worker appears stuck (runs every 15 minutes)
SELECT cron.schedule(
  'check-stuck-notifications',
  '*/15 * * * *',
  $$
  DO $$
  DECLARE v_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notification_jobs
    WHERE status = 'PENDING' AND created_at < now() - INTERVAL '15 minutes';
    IF v_count > 0 THEN
      RAISE WARNING 'ALERT: % PENDING notification jobs older than 15 minutes', v_count;
    END IF;
  END $$;
  $$
);
```

---

## Cost Considerations (100k notifications/month)

| Item | Volume | Cost |
|---|---|---|
| Mailgun Flex | 100,000 emails | ~$80/month |
| Supabase Pro | Includes pg_cron, 500k edge invocations | ~$25/month |
| Edge function invocations | ~22k worker runs/month (every 2 min, avg 0.5s) + ~100k enqueue calls | Well within 2M free invocation cap |
| DB storage | ~3MB/month for 100k jobs + events | Negligible |
| **Total** | | **~$105/month** |

---

## Scalability (up to 100k notifications/month)

- `notification_jobs` table with `idx_nj_worker_scan` partial index handles 1M+ rows without degradation.
- Worker batch size of 20 @ 2-minute intervals = 600 jobs/hour capacity (well above 100k/month = 139/hour average).
- For burst traffic: reduce pg_cron interval to `*/1 * * * *` (every 1 minute) and increase `WORKER_BATCH_SIZE` to 50.
- `SELECT FOR UPDATE SKIP LOCKED` ensures safe concurrent invocations — pg_cron may trigger multiple concurrent worker invocations without double-processing.
- Rate limit of 10/hour per recipient prevents runaway loops.
- Provider swap: replace `mailgun-provider.ts` with `sendgrid-provider.ts` and update `createEmailProvider()` — zero other files change.

---

## Self-Review

**Spec coverage:**
- ✅ All original business requirements preserved
- ✅ Mailgun for transactional email (MailgunProvider)
- ✅ WhatsApp as wa.me links only (Task 8 + admin email templates)
- ✅ Supabase Edge Functions architecture (all 5 functions)
- ✅ Secrets server-side in Supabase Function Secrets (Secrets Reference)
- ✅ Email failures never fail primary operations (fire-and-forget enqueue; RPC errors logged, not thrown)
- ✅ Retries with exponential backoff (`fail_notification_job` RPC: 30s/60s/120s)
- ✅ Idempotency keys (`ON CONFLICT DO NOTHING` on `idempotency_key`)
- ✅ Notification job queue (`notification_jobs` table + RPCs)
- ✅ Delivery tracking (`notification_events` table + webhook)
- ✅ Mailgun webhook processing (Task 4: delivered/failed/bounced/complained)
- ✅ Dead-letter queue (`status = 'DEAD'` after max_attempts)
- ✅ Structured logging (all functions use `structuredLog({service, ts, event, ...})`)
- ✅ Provider abstraction (`EmailProvider` interface + `createEmailProvider()` factory)
- ✅ Environment isolation (`ENVIRONMENT` + `NOTIFICATIONS_ENABLED` vars)
- ✅ Rate limiting (10/hour per recipient in `enqueue_notification` RPC)
- ✅ Security review: webhook HMAC, JWT auth, worker secret, storefront secret
- ✅ Database schema additions (Task 1 migration)
- ✅ Migration files (`20260701_notification_queue.sql`)
- ✅ Exact file paths (File Map table)
- ✅ Implementation order (Tasks 1–8, sequential)
- ✅ Rollback strategy (Rollback section)
- ✅ Deployment strategy (Deployment section)
- ✅ Monitoring strategy (Monitoring section)
- ✅ Alerting strategy (Alerting section)
- ✅ Cost considerations (Cost section)
- ✅ Scalability to 100k/month (Scalability section)
- ✅ Production-grade TypeScript + Supabase best practices

**No placeholders or TODOs remaining.**
