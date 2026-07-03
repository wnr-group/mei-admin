SELECT
    o.id,
    o.order_number,
    o.customer_id,
    o.status,
    o.payment_method,
    o.total,
    o.notes,
    o.created_at,
    COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.order_number = '#ORD-9019'
GROUP BY o.id, o.order_number, o.customer_id, o.status, o.payment_method, o.total, o.notes, o.created_at;
