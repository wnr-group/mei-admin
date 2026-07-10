import { createClient } from '@/lib/supabase/server';
import ImportPageClient from '@/components/products/import/ImportPageClient';

/**
 * Bulk Product Import (MEI-42).
 *
 * Server Component: loads the category list needed for client-side CSV
 * validation, then hands off to the client component that owns the
 * upload/parse/preview state. Preview only — no rows are written to the
 * database and no Edge Functions are called from this page.
 */
export default async function BulkImportPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .is('deleted_at', null);

  const categories = (data ?? []) as Array<{ id: string; name: string }>;

  return <ImportPageClient categories={categories} />;
}
