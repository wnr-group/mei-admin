import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type CustomizationType =
  | 'UNSTITCHED'
  | 'SEMI_STITCHED'
  | 'STANDARD_SIZE'
  | 'CUSTOM_TAILORED';

export interface BlouseConfiguration {
  id: string;
  product_id: string;
  customization_type?: CustomizationType;
  includes_blouse: boolean;
  stitching_options: string[];
  blouse_measurement_template_id?: string;
  created_at: string;
}

export async function getBlouseConfig(
  productId: string,
  customizationType?: CustomizationType
): Promise<BlouseConfiguration | null> {
  let query = supabase
    .from('blouse_configurations')
    .select('*')
    .eq('product_id', productId);
  if (customizationType) query = query.eq('customization_type', customizationType);
  const { data, error } = await query.single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function upsertBlouseConfig(input: {
  product_id: string;
  customization_type?: CustomizationType;
  includes_blouse?: boolean;
  stitching_options?: string[];
}): Promise<BlouseConfiguration> {
  const { data, error } = await supabase
    .from('blouse_configurations')
    .upsert({
      product_id: input.product_id,
      customization_type: input.customization_type,
      includes_blouse: input.includes_blouse ?? true,
      stitching_options: input.stitching_options ?? ['STITCHED', 'UNSTITCHED'],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
