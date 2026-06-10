-- Seed: create default super_admin user
-- Credentials: admin@mei.com / Admin@1234
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  is_sso_user,
  is_anonymous,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@mei.com',
  crypt('Admin@1234', gen_salt('bf')),
  now(),
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"MEI Admin"}',
  false,
  false,
  false,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Upsert profile as super_admin
INSERT INTO public.profiles (id, role, full_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'super_admin', 'MEI Admin')
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', full_name = 'MEI Admin';
