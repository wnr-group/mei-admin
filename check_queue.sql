-- Check notification queue status
SELECT
  status,
  COUNT(*) as count,
  MAX(created_at) as latest,
  MAX(last_error) as recent_error
FROM notification_jobs
GROUP BY status
ORDER BY status;

-- Show all jobs from last 10 minutes
SELECT id, type, recipient_email, status, attempts, last_error, created_at
FROM notification_jobs
WHERE created_at > now() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
