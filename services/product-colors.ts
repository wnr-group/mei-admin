import { createUntypedClient } from '@/lib/supabase/client'

export interface ProductColor {
  id: string
  product_id: string
  label: string
  hex_code?: string
  swatch_image_url?: string
  sort_order: number
  created_at: string
  deleted_at?: string
}

export interface ProductColorInsert {
  product_id: string
  label: string
  hex_code?: string
  swatch_image_url?: string
  sort_order?: number
}

export interface ProductColorUpdate {
  label?: string
  hex_code?: string
  swatch_image_url?: string
  sort_order?: number
}

export async function getProductColors(productId: string): Promise<ProductColor[]> {
  const supabase = createUntypedClient()
  const { data, error } = await supabase
    .from('product_colors')
    .select('*')
    .eq('product_id', productId)
    .is('deleted_at', null)
    .order('sort_order')

  if (error) throw error
  return (data || []) as ProductColor[]
}

export async function createColor(input: ProductColorInsert): Promise<ProductColor> {
  const supabase = createUntypedClient()
  const { data, error } = await supabase
    .from('product_colors')
    .insert({
      ...input,
      sort_order: input.sort_order ?? 0
    })
    .select()
    .single()

  if (error) throw error
  return data as ProductColor
}

export async function updateColor(id: string, input: ProductColorUpdate): Promise<ProductColor> {
  const supabase = createUntypedClient()
  const { data, error } = await supabase
    .from('product_colors')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ProductColor
}

export async function deleteColor(id: string): Promise<void> {
  const supabase = createUntypedClient()
  const { error } = await supabase
    .from('product_colors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
