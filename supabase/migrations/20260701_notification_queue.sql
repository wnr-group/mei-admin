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
