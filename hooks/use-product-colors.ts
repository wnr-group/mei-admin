'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProductColors, createColor, updateColor, deleteColor, type ProductColorInsert, type ProductColorUpdate } from '@/services/product-colors'

const queryKeys = {
  colors: (productId: string) => ['products', productId, 'colors'] as const,
}

export function useProductColors(productId: string) {
  return useQuery({
    queryKey: queryKeys.colors(productId),
    queryFn: () => getProductColors(productId),
    enabled: !!productId,
  })
}

export function useCreateColor(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof createColor>[0]) => createColor(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.colors(productId) })
    },
  })
}

export function useUpdateColor(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateColor>[1] }) => {
      return updateColor(id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.colors(productId) })
    },
  })
}

export function useDeleteColor(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteColor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.colors(productId) })
    },
  })
}
