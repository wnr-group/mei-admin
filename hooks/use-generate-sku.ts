'use client'

import { createClient } from '@supabase/supabase-js'
import type { CustomizationType } from '@/services/product-variants'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateVariantSku(
  productCode: string,
  color: string | null,
  size: string | null,
  type: CustomizationType
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_variant_sku', {
    p_product_code: productCode,
    p_color: color,
    p_size: size,
    p_type: type,
  })
  if (error) throw error
  return data as string
}
