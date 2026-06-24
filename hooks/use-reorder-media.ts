'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function reorderMedia(items: { id: string; sort_order: number }[]) {
  for (const item of items) {
    const { error } = await supabase
      .from('product_media')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
    if (error) throw error
  }
}

export function useReorderMedia(productId: string, colorId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) => reorderMedia(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', productId, 'media'] })
    },
  })
}
