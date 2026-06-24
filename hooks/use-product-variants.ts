'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProductVariants, createVariant, updateVariant, deleteVariant, type ProductVariantInsert, type ProductVariantUpdate } from '@/services/product-variants'

const queryKeys = {
  variants: (productId: string) => ['products', productId, 'variants'] as const,
}

export function useProductVariants(productId: string) {
  return useQuery({
    queryKey: queryKeys.variants(productId),
    queryFn: () => getProductVariants(productId),
    enabled: !!productId,
  })
}

export function useCreateVariant(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof createVariant>[0]) => createVariant(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants(productId) })
    },
  })
}

export function useUpdateVariant(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateVariant>[1] }) => {
      return updateVariant(id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants(productId) })
    },
  })
}

export function useDeleteVariant(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVariant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants(productId) })
    },
  })
}
