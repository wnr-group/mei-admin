-- Enquiry status enum
CREATE TYPE public.enquiry_status AS ENUM ('NEW', 'REPLIED', 'CLOSED');

-- Enquiries (contact form submissions from storefront)
CREATE TABLE public.enquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  status      public.enquiry_status NOT NULL DEFAULT 'NEW',
  admin_reply TEXT,
  replied_at  TIMESTAMPTZ,
  replied_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enquiries_status  ON public.enquiries(status);
CREATE INDEX idx_enquiries_created ON public.enquiries(created_at DESC);

-- Banners (homepage promotional images)
CREATE TABLE public.banners (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link_url   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_banners_active_sort
  ON public.banners(sort_order)
  WHERE is_active = true;

CREATE TRIGGER banners_set_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Settings — JSONB key-value store for app-wide config
CREATE TABLE public.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('store_name',        '"MEI Bridal Couture"',   'Display name of the store'),
  ('currency',          '"INR"',                   'Currency code'),
  ('orders_per_page',   '20',                      'Pagination size for orders table'),
  ('products_per_page', '20',                      'Pagination size for products table');
