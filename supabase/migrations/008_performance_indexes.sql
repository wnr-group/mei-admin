-- Compound index for the most common orders query (status + date range)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders(status, created_at DESC);

-- Compound index for product listing (status + category)
CREATE INDEX IF NOT EXISTS idx_products_status_category
  ON public.products(status, category_id)
  WHERE deleted_at IS NULL;

-- Full-text search on product name (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING GIN (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Full-text search on customer name
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON public.customers USING GIN (name gin_trgm_ops);

-- Enquiries by email for duplicate detection
CREATE INDEX IF NOT EXISTS idx_enquiries_email
  ON public.enquiries(email);

-- Settings lookup is always by primary key — no extra index needed
-- Orders by customer (dashboard: "orders for this customer")
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON public.orders(customer_id, created_at DESC);
