SELECT
    oi.id,
    oi.product_name,
    oi.quantity,
    oi.unit_price,
    oi.created_at,
    oi.variant_id
FROM order_items oi
WHERE oi.order_id = '856394cc-c70f-43d2-9e85-95370f632f8d';
