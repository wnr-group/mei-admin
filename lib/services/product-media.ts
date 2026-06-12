import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ProductMedia {
  id: string;
  product_id: string;
  color_id?: string;
  variant_id?: string;
  url: string;
  alt_text?: string;
  is_primary: boolean;
  media_type: 'IMAGE' | 'VIDEO';
  thumbnail_url?: string;
  video_provider?: string;
  sort_order: number;
  created_at: string;
}

export async function getProductMedia(
  productId: string,
  colorId?: string
): Promise<ProductMedia[]> {
  let query = supabase
    .from('product_media')
    .select('*')
    .eq('product_id', productId)
    .is('deleted_at', null);
  if (colorId) query = query.eq('color_id', colorId);
  const { data, error } = await query.order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function uploadMedia(input: {
  product_id: string;
  url: string;
  alt_text?: string;
  media_type?: 'IMAGE' | 'VIDEO';
  color_id?: string;
  variant_id?: string;
  is_primary?: boolean;
  sort_order?: number;
}): Promise<ProductMedia> {
  const { data, error } = await supabase
    .from('product_media')
    .insert({
      ...input,
      media_type: input.media_type ?? 'IMAGE',
      is_primary: input.is_primary ?? false,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMedia(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_media')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
