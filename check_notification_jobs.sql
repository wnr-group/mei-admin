SELECT
    id,
    type,
    recipient_email,
    status,
    attempts,
    max_attempts,
    created_at,
    sent_at,
    last_error,
    payload::text
FROM notification_jobs
WHERE payload->>'order_number' = '#ORD-9019'
   OR idempotency_key LIKE '%9019%'
ORDER BY created_at DESC;
