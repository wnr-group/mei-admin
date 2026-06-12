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
export type MeasurementFieldKey =
  | 'bust'
  | 'waist'
  | 'hip'
  | 'shoulder'
  | 'blouse_length'
  | 'sleeve_length'
  | 'lehenga_length'
  | 'height'
  | 'custom';

export interface MeasurementTemplate {
  id: string;
  name: string;
  category_id?: string;
  product_id?: string;
  customization_type?: CustomizationType;
  version: number;
  is_active: boolean;
  created_at: string;
}

export async function getTemplates(filters?: {
  categoryId?: string;
  productId?: string;
}): Promise<MeasurementTemplate[]> {
  let query = supabase
    .from('measurement_templates')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null);
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters?.productId) query = query.eq('product_id', filters.productId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createTemplate(input: {
  name: string;
  categoryId?: string;
  productId?: string;
  customizationType?: CustomizationType;
}): Promise<MeasurementTemplate> {
  const { data, error } = await supabase
    .from('measurement_templates')
    .insert({
      name: input.name,
      category_id: input.categoryId,
      product_id: input.productId,
      customization_type: input.customizationType,
      version: 1,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
