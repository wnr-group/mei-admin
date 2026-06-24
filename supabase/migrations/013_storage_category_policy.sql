DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can upload category images'
  ) THEN
    CREATE POLICY "Admins can upload category images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'product-images'
        AND public.is_admin()
        AND (storage.foldername(name))[1] = 'categories'
      );
  END IF;
END $$;