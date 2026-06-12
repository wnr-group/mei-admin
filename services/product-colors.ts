import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import type { ProductColor, ProductColorInsert } from '@/types'

export async function getProductColors(productId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('product_colors')
    .select('*')
    .eq('product_id', productId)
    .is('deleted_at', null)
    .order('sort_order')

  if (error) throw toAppError(new Error(error.message))
  return (data || []) as ProductColor[]
}

export async function createColor(input: ProductColorInsert) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('product_colors')
    .insert({
      ...input,
      sort_order: input.sort_order ?? 0
    })
    .select()
    .single()

  if (error) throw toAppError(new Error(error.message))
  return data as ProductColor
}

export async function updateColor(id: string, input: Partial<ProductColor>) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('product_colors')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw toAppError(new Error(error.message))
  return data as ProductColor
}

export async function deleteColor(id: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('product_colors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw toAppError(new Error(error.message))
}
