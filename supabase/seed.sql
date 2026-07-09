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

-- ── 50 Seed Products (10 per Category) ──
-- Category: Bridal Lehengas
INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 1',
  'bridal-lehengas-piece-1',
  'MEI-BL-101',
  76629.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 1 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 2',
  'bridal-lehengas-piece-2',
  'MEI-BL-102',
  185604.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 2 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Zardozi', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 3',
  'bridal-lehengas-piece-3',
  'MEI-BL-103',
  131575.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 3 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 4',
  'bridal-lehengas-piece-4',
  'MEI-BL-104',
  58838.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 4 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Kundan', 'Aari', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 5',
  'bridal-lehengas-piece-5',
  'MEI-BL-105',
  100865.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 5 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 6',
  'bridal-lehengas-piece-6',
  'MEI-BL-106',
  167888.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 6 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Tailoring'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 7',
  'bridal-lehengas-piece-7',
  'MEI-BL-107',
  78229.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 7 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Zardozi', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 8',
  'bridal-lehengas-piece-8',
  'MEI-BL-108',
  120830.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 8 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 9',
  'bridal-lehengas-piece-9',
  'MEI-BL-109',
  186837.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 9 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Bridal Lehenga Piece 10',
  'bridal-lehengas-piece-10',
  'MEI-BL-110',
  137019.00,
  'PUBLISHED',
  'This is a premium handcrafted Bridal Lehenga Piece 10 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Thread', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'bridal-lehengas'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

-- Category: Sarees
INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 1',
  'sarees-piece-1',
  'MEI-SR-101',
  207659.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 1 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Kundan'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 2',
  'sarees-piece-2',
  'MEI-SR-102',
  47524.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 2 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Cut', 'Tailoring'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 3',
  'sarees-piece-3',
  'MEI-SR-103',
  203026.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 3 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop',
  ARRAY['Thread', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 4',
  'sarees-piece-4',
  'MEI-SR-104',
  167860.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 4 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Tailoring', 'Aari', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 5',
  'sarees-piece-5',
  'MEI-SR-105',
  203067.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 5 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Kundan', 'Mirror', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 6',
  'sarees-piece-6',
  'MEI-SR-106',
  118051.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 6 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Cut', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 7',
  'sarees-piece-7',
  'MEI-SR-107',
  115892.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 7 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 8',
  'sarees-piece-8',
  'MEI-SR-108',
  33248.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 8 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Kundan', 'Aari'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 9',
  'sarees-piece-9',
  'MEI-SR-109',
  109804.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 9 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Tailoring', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Saree Piece 10',
  'sarees-piece-10',
  'MEI-SR-110',
  153968.00,
  'PUBLISHED',
  'This is a premium handcrafted Saree Piece 10 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Thread', 'Kundan'],
  (SELECT id FROM public.categories WHERE slug = 'sarees'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

-- Category: Evening Gowns
INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 1',
  'evening-gowns-piece-1',
  'MEI-EG-101',
  83681.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 1 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Thread', 'Tailoring'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 2',
  'evening-gowns-piece-2',
  'MEI-EG-102',
  181805.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 2 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Mirror', 'Thread'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 3',
  'evening-gowns-piece-3',
  'MEI-EG-103',
  145994.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 3 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 4',
  'evening-gowns-piece-4',
  'MEI-EG-104',
  186493.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 4 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Zardozi', 'Thread', 'Tailoring'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 5',
  'evening-gowns-piece-5',
  'MEI-EG-105',
  132686.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 5 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Kundan', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 6',
  'evening-gowns-piece-6',
  'MEI-EG-106',
  75220.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 6 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 7',
  'evening-gowns-piece-7',
  'MEI-EG-107',
  154418.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 7 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Zardozi', 'Cut', 'Aari'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 8',
  'evening-gowns-piece-8',
  'MEI-EG-108',
  36173.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 8 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 9',
  'evening-gowns-piece-9',
  'MEI-EG-109',
  59792.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 9 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Tailoring', 'Kundan'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Evening Gown Piece 10',
  'evening-gowns-piece-10',
  'MEI-EG-110',
  52115.00,
  'PUBLISHED',
  'This is a premium handcrafted Evening Gown Piece 10 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Tailoring'],
  (SELECT id FROM public.categories WHERE slug = 'evening-gowns'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

-- Category: Couture
INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 1',
  'couture-piece-1',
  'MEI-CT-101',
  169121.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 1 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Tailoring', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 2',
  'couture-piece-2',
  'MEI-CT-102',
  126991.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 2 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 3',
  'couture-piece-3',
  'MEI-CT-103',
  128712.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 3 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 4',
  'couture-piece-4',
  'MEI-CT-104',
  210816.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 4 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Thread', 'Cut', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 5',
  'couture-piece-5',
  'MEI-CT-105',
  139895.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 5 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Aari', 'Thread'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 6',
  'couture-piece-6',
  'MEI-CT-106',
  170399.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 6 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Zardozi', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 7',
  'couture-piece-7',
  'MEI-CT-107',
  199203.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 7 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Kundan', 'Tailoring', 'Thread'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 8',
  'couture-piece-8',
  'MEI-CT-108',
  205868.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 8 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 9',
  'couture-piece-9',
  'MEI-CT-109',
  103782.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 9 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Zardozi', 'Kundan'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Coutur Piece 10',
  'couture-piece-10',
  'MEI-CT-110',
  199847.00,
  'PUBLISHED',
  'This is a premium handcrafted Coutur Piece 10 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Mirror', 'Tailoring'],
  (SELECT id FROM public.categories WHERE slug = 'couture'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

-- Category: Suits
INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 1',
  'suits-piece-1',
  'MEI-ST-101',
  49600.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 1 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 2',
  'suits-piece-2',
  'MEI-ST-102',
  90331.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 2 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Kundan', 'Zardozi', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  true, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 3',
  'suits-piece-3',
  'MEI-ST-103',
  172728.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 3 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop',
  ARRAY['Cut', 'Mirror', 'Tailoring'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 4',
  'suits-piece-4',
  'MEI-ST-104',
  41703.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 4 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Zardozi', 'Kundan'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 5',
  'suits-piece-5',
  'MEI-ST-105',
  177170.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 5 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Tailoring', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 6',
  'suits-piece-6',
  'MEI-ST-106',
  31230.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 6 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Aari', 'Zardozi', 'Kundan'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 7',
  'suits-piece-7',
  'MEI-ST-107',
  130302.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 7 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Thread', 'Cut'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 8',
  'suits-piece-8',
  'MEI-ST-108',
  67535.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 8 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop',
  ARRAY['Mirror', 'Cut', 'Zardozi'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  false  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 9',
  'suits-piece-9',
  'MEI-ST-109',
  82099.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 9 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop',
  ARRAY['Zardozi', 'Kundan', 'Aari'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

INSERT INTO public.products (
  name, slug, product_code, price, status, description, image_url, work_types, category_id, is_featured, is_new_arrival
) VALUES (
  'Suit Piece 10',
  'suits-piece-10',
  'MEI-ST-110',
  52840.00,
  'PUBLISHED',
  'This is a premium handcrafted Suit Piece 10 made with traditional embroidery.',
  'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ARRAY['Kundan', 'Mirror'],
  (SELECT id FROM public.categories WHERE slug = 'suits'),
  false, -- Make first 2 products featured
  true  -- Make last 2 products new arrivals
) ON CONFLICT (product_code) DO NOTHING;

