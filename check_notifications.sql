SELECT
    id,
    order_id,
    order_number,
    notification_type,
    status,
    recipient,
    created_at
FROM notification_queue
WHERE order_number = '#ORD-9019'
ORDER BY created_at DESC;
