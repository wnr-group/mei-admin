'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/services/products'
import type { ProductInsert, ProductUpdate } from '@/types'

type GetProductsOptions = Parameters<typeof getProducts>[0]

export function useProducts(options?: GetProductsOptions) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: () => getProducts(options),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (product: ProductInsert) => createProduct(product),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProductUpdate }) =>
      updateProduct(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}
