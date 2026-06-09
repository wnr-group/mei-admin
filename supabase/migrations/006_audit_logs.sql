CREATE TABLE public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,        -- 'CREATE', 'UPDATE', 'DELETE'
  resource_type TEXT NOT NULL,        -- 'product', 'order', 'banner', etc.
  resource_id   TEXT,
  old_data      JSONB,
  new_data      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_admin    ON public.audit_logs(admin_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created  ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON public.audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins insert audit logs"
  ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());
-- No UPDATE or DELETE policies — audit logs are append-only
