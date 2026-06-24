drop extension if exists "pg_net";

drop index if exists "public"."idx_customers_name_trgm";

drop index if exists "public"."idx_enquiries_email";

drop index if exists "public"."idx_orders_customer_created";

drop index if exists "public"."idx_orders_status_created";

drop index if exists "public"."idx_products_name_trgm";

drop index if exists "public"."idx_products_status_category";

drop extension if exists "pg_trgm";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;


  create policy "Admins can insert audit logs"
  on "public"."audit_logs"
  as permissive
  for insert
  to authenticated
with check (true);


drop policy "Admins can update product images" on "storage"."objects";

drop policy "Public can read product images" on "storage"."objects";

drop policy "Admins can delete product images" on "storage"."objects";

drop policy "Admins can upload product images" on "storage"."objects";


  create policy "Public can view product images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'product-images'::text));



  create policy "Admins can delete product images"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'product-images'::text) AND public.is_admin()));



  create policy "Admins can upload product images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'product-images'::text) AND public.is_admin()));



