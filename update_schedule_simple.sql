-- Unschedule old schedule
SELECT cron.unschedule('process-notification-queue');

-- Create new schedule with simple secret
SELECT cron.schedule(
  'process-notification-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker',
    headers := json_build_object(
      'Content-Type',    'application/json',
      'x-worker-secret', 'testing-secret-12345'
    )::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
