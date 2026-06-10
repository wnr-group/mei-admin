-- Product status enum
CREATE TYPE public.product_status AS ENUM ('PUBLISHED', 'DRAFT');

-- Categories
CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_categories_active_sort
  ON public.categories(sort_order)
  WHERE deleted_at IS NULL;

-- Products
CREATE TABLE public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  work_types  TEXT[] NOT NULL DEFAULT '{}',
  status      public.product_status NOT NULL DEFAULT 'DRAFT',
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_products_category  ON public.products(category_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status    ON public.products(status)        WHERE deleted_at IS NULL;
CREATE INDEX idx_products_created   ON public.products(created_at DESC) WHERE deleted_at IS NULL;

-- Shared trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial categories matching existing mock data
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Bridal Lehengas', 'bridal-lehengas', 1),
  ('Sarees',          'sarees',          2),
  ('Evening Gowns',   'evening-gowns',   3),
  ('Couture',         'couture',         4),
  ('Suits',           'suits',           5);
