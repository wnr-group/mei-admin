'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import type { CustomizationType } from '@/services/product-variants'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface BulkVariantSpec {
  color_id?: string
  size_label: string
  customization_type: CustomizationType
}

async function bulkCreateVariants(productId: string, specs: BulkVariantSpec[]) {
  const { data, error } = await supabase.functions.invoke('bulk-create-variants', {
    body: { product_id: productId, specs },
  })
  if (error) throw error
  return data
}

export function useBulkCreateVariants(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (specs: BulkVariantSpec[]) => bulkCreateVariants(productId, specs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', productId, 'variants'] })
    },
  })
}
