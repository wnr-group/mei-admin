-- Fix RLS policies referencing auth.users to use public.is_admin() instead

-- 1. size_systems
DROP POLICY IF EXISTS "size_systems_admin_all" ON public.size_systems;
CREATE POLICY "size_systems_admin_all" ON public.size_systems FOR ALL USING (public.is_admin());

-- 2. size_system_entries
DROP POLICY IF EXISTS "size_system_entries_admin_all" ON public.size_system_entries;
CREATE POLICY "size_system_entries_admin_all" ON public.size_system_entries FOR ALL USING (public.is_admin());

-- 3. product_colors
DROP POLICY IF EXISTS "product_colors_admin_all" ON public.product_colors;
CREATE POLICY "product_colors_admin_all" ON public.product_colors FOR ALL USING (public.is_admin());

-- 4. product_variants
DROP POLICY IF EXISTS "product_variants_admin_all" ON public.product_variants;
CREATE POLICY "product_variants_admin_all" ON public.product_variants FOR ALL USING (public.is_admin());

-- 5. product_media
DROP POLICY IF EXISTS "product_media_admin_all" ON public.product_media;
CREATE POLICY "product_media_admin_all" ON public.product_media FOR ALL USING (public.is_admin());

-- 6. measurement_templates
DROP POLICY IF EXISTS "measurement_templates_admin_all" ON public.measurement_templates;
CREATE POLICY "measurement_templates_admin_all" ON public.measurement_templates FOR ALL USING (public.is_admin());

-- 7. measurement_template_fields
DROP POLICY IF EXISTS "measurement_template_fields_admin_all" ON public.measurement_template_fields;
CREATE POLICY "measurement_template_fields_admin_all" ON public.measurement_template_fields FOR ALL USING (public.is_admin());

-- 8. blouse_configurations
DROP POLICY IF EXISTS "blouse_configurations_admin_all" ON public.blouse_configurations;
CREATE POLICY "blouse_configurations_admin_all" ON public.blouse_configurations FOR ALL USING (public.is_admin());

-- 9. order_item_measurements
DROP POLICY IF EXISTS "order_item_measurements_admin_all" ON public.order_item_measurements;
CREATE POLICY "order_item_measurements_admin_all" ON public.order_item_measurements FOR ALL USING (public.is_admin());
