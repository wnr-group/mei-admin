import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type CustomizationType = 'UNSTITCHED' | 'SEMI_STITCHED' | 'STANDARD_SIZE' | 'CUSTOM_TAILORED'

export interface ProductVariant {
  id: string
  product_id: string
  color_id?: string
  size_entry_id?: string
  size_label?: string
  customization_type: CustomizationType
  sku?: string
  price_override?: number
  stock_quantity: number
  track_inventory: boolean
  allow_backorder: boolean
  low_stock_threshold: number
  is_available: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ProductVariantInsert {
  product_id: string
  color_id?: string
  size_entry_id?: string
  size_label?: string
  customization_type: CustomizationType
  sku?: string
  price_override?: number
  stock_quantity?: number
  track_inventory?: boolean
  allow_backorder?: boolean
  low_stock_threshold?: number
  is_available?: boolean
  sort_order?: number
}

export interface ProductVariantUpdate {
  color_id?: string
  size_entry_id?: string
  size_label?: string
  customization_type?: CustomizationType
  sku?: string
  price_override?: number
  stock_quantity?: number
  track_inventory?: boolean
  allow_backorder?: boolean
  low_stock_threshold?: number
  is_available?: boolean
  sort_order?: number
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .is('deleted_at', null)
    .order('sort_order')

  if (error) throw error
  return (data || []) as ProductVariant[]
}

export async function createVariant(input: ProductVariantInsert): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      ...input,
      stock_quantity: input.stock_quantity ?? 0,
      track_inventory: input.track_inventory ?? false,
      allow_backorder: input.allow_backorder ?? true,
      low_stock_threshold: input.low_stock_threshold ?? 5,
      is_available: input.is_available ?? true,
      sort_order: input.sort_order ?? 0
    })
    .select()
    .single()

  if (error) throw error
  return data as ProductVariant
}

export async function updateVariant(id: string, input: ProductVariantUpdate): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from('product_variants')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ProductVariant
}

export async function deleteVariant(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_variants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function getEffectivePrice(variantId: string): Promise<number> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('price_override, product_id')
    .eq('id', variantId)
    .single()

  if (error) throw error

  if (data.price_override !== null) {
    return data.price_override
  }

  const { data: product } = await supabase
    .from('products')
    .select('price')
    .eq('id', data.product_id)
    .single()

  return product?.price || 0
}
