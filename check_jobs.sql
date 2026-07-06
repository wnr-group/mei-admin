SELECT
    id,
    order_id,
    event_type,
    status,
    created_at,
    updated_at,
    next_retry
FROM notification_jobs
WHERE order_id IN (
    SELECT id FROM orders WHERE order_number = '#ORD-9019'
)
ORDER BY created_at DESC;
