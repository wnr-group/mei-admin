-- Enable RLS on all tables
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings    ENABLE ROW LEVEL SECURITY;

-- Helper: is current JWT user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$;

-- Helper: is current JWT user a super_admin?
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$;

-- profiles
CREATE POLICY "Admins read profiles"
  ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Own profile update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- categories: admins full CRUD
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- products: admins full CRUD
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- customers: admins full CRUD
CREATE POLICY "Admins manage customers"
  ON public.customers FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- orders: admins read/insert/update; only super_admin deletes
CREATE POLICY "Admins read orders"
  ON public.orders FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins insert orders"
  ON public.orders FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Super admin delete orders"
  ON public.orders FOR DELETE USING (public.is_super_admin());

-- order_items: admins full CRUD
CREATE POLICY "Admins manage order_items"
  ON public.order_items FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- enquiries: admins full CRUD
CREATE POLICY "Admins manage enquiries"
  ON public.enquiries FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- banners: admins full CRUD
CREATE POLICY "Admins manage banners"
  ON public.banners FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- settings: admins read; only super_admin writes
CREATE POLICY "Admins read settings"
  ON public.settings FOR SELECT USING (public.is_admin());
CREATE POLICY "Super admin manage settings"
  ON public.settings FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
