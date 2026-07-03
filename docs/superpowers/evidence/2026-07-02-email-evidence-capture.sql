-- Email Notification Root-Cause — Phase 2/3 Evidence Capture Pack
-- Project: hjhqemsyufsifmgespur
-- ALL QUERIES ARE READ-ONLY. Run in Supabase Dashboard → SQL Editor.
-- Paste each result back for root-cause classification (see Plan A, Task 2 decoder).

-- ── A1. Status distribution + no-op detection (decisive) ─────────────────────
-- If SENT rows have noop_marked_sent > 0 → no-op provider gate confirmed.
SELECT
  status,
  COUNT(*)                                                          AS n,
  COUNT(*) FILTER (WHERE provider_message_id LIKE 'noop-%')         AS noop_marked_sent,
  MAX(created_at)                                                   AS latest
FROM notification_jobs
GROUP BY status
ORDER BY status;

-- ── A2. Last 20 jobs, full detail ────────────────────────────────────────────
-- PENDING attempts=0 → worker never ran. DEAD+last_error → provider failing.
-- SENT + provider_message_id LIKE 'noop-%' → no-op gate. No rows → not enqueued.
SELECT id, type, recipient_email, status, attempts,
       provider_message_id, last_error, created_at, sent_at
FROM notification_jobs
ORDER BY created_at DESC
LIMIT 20;

-- ── A3. Is the cron job defined? Which command variant (GUC vs hardcoded)? ────
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'process-notification-queue';

-- ── A4. Did cron actually fire, and what did net.http_post return? ────────────
SELECT jrd.status, jrd.return_message, jrd.start_time, jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-notification-queue'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- ── A5. HTTP status the worker returned to cron (401 = rejected at gateway) ───
SELECT id, status_code, (content::text) AS body, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;

-- ── A6. Are the worker-invocation GUCs set? (NULL/empty → cron never reaches worker)
SELECT current_setting('app.notification_worker_url', true) AS worker_url,
       (current_setting('app.worker_secret', true) IS NOT NULL
         AND current_setting('app.worker_secret', true) <> '') AS worker_secret_present;
