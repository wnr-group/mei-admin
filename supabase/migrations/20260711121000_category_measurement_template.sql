-- Assign a reusable measurement template to a category.
-- Products inherit their primary category's template unless they override it.
-- One template per category; a template may be reused across many categories.
-- ON DELETE SET NULL: deleting a library template leaves the category with no
-- template (falls back to "no measurements"), never blocks the delete.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS measurement_template_id UUID
  REFERENCES public.measurement_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_measurement_template
  ON public.categories(measurement_template_id)
  WHERE measurement_template_id IS NOT NULL;
