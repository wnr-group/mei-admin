ALTER TABLE public.product_categories
ADD COLUMN IF NOT EXISTS manually_included BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS manually_excluded BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.product_categories
ADD CONSTRAINT product_categories_flags_check CHECK (
    NOT(
        manually_included = true
        AND manually_excluded = true
    )
);



