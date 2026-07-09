ALTER TABLE public.products
ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN is_new_arrival BOOLEAN NOT NULL DEFAULT false;