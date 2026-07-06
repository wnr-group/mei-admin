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
