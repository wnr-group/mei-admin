CREATE TABLE IF NOT EXISTS size_systems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS size_system_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id  UUID NOT NULL REFERENCES size_systems(id),
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  bust_cm    NUMERIC(5,1),
  waist_cm   NUMERIC(5,1),
  hip_cm     NUMERIC(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (system_id, label)
);

ALTER TABLE size_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_system_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "size_systems_anon_select" ON size_systems FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "size_systems_admin_all" ON size_systems FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "size_system_entries_anon_select" ON size_system_entries FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "size_system_entries_admin_all" ON size_system_entries FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
