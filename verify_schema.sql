SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'enquiries')
  AND column_name = 'deleted_at';
