SELECT
    order_number,
    customer_id,
    total,
    created_at
FROM orders
WHERE order_number LIKE '%9019%'
ORDER BY created_at DESC;
