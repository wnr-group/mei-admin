-- Custom-named measurement fields.
-- Adds a free-text label + a 'custom' enum value so admins can add fields
-- like "Trail length" that aren't in the fixed anatomical key list.

-- The 'custom' enum value is added in the preceding migration
-- (20260711119000); Postgres forbids adding + using an enum value in one
-- transaction, so the partial index below relies on it already existing.

-- 1. Free-text display name (null for the fixed anatomical keys).
ALTER TABLE public.measurement_template_fields
  ADD COLUMN IF NOT EXISTS label TEXT;

-- 2. Replace the single unique constraint with two partial indexes.
--    Fixed keys stay one-per-template; custom fields are unique by label,
--    so a template can hold many distinct custom fields.
ALTER TABLE public.measurement_template_fields
  DROP CONSTRAINT IF EXISTS measurement_template_fields_template_id_field_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mtf_template_fixed_key
  ON public.measurement_template_fields (template_id, field_key)
  WHERE field_key <> 'custom';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mtf_template_custom_label
  ON public.measurement_template_fields (template_id, label)
  WHERE field_key = 'custom';
