'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function setPrimaryMedia(mediaId: string, productId: string, colorId?: string) {
  const { error } = await supabase.functions.invoke('set-primary-media', {
    body: { media_id: mediaId, product_id: productId, color_id: colorId ?? null },
  })
  if (error) throw error
}

export function useSetPrimaryMedia(productId: string, colorId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string) => setPrimaryMedia(mediaId, productId, colorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', productId, 'media'] })
    },
  })
}
