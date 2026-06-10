-- Add user_agent and session_id to audit_logs for security forensics
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;
