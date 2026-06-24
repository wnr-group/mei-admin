-- Soft-delete support for orders and enquiries

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial indexes so active-record queries scan only non-deleted rows
CREATE INDEX IF NOT EXISTS idx_orders_not_deleted
  ON public.orders(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_not_deleted
  ON public.enquiries(created_at DESC)
  WHERE deleted_at IS NULL;

-- Audit log query indexes (idx_audit_logs_created and idx_audit_logs_resource
-- already exist from 006_audit_logs.sql; only the action index is new)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action);

-- Idempotent re-declarations of existing indexes (safe no-ops if present)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type
  ON public.audit_logs(resource_type);
