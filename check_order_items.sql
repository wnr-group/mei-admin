SELECT
    oi.id,
    oi.order_id,
    oi.product_id,
    oi.quantity,
    oi.unit_price,
    oi.subtotal,
    oi.status,
    oi.created_at,
    p.name as product_name
FROM order_items oi
LEFT JOIN products p ON oi.product_id = p.id
WHERE oi.order_id = '856394cc-c70f-43d2-9e85-95370f632f8d';
