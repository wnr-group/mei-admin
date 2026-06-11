CREATE POLICY "Admins can upload category images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
    AND (storage.foldername(name))[1] = 'categories'
  );
