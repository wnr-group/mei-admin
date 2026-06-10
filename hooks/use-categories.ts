'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categories'
import type { CategoryInsert, CategoryUpdate } from '@/types'

type GetCategoriesOptions = Parameters<typeof getCategories>[0]

export function useCategories(options?: GetCategoriesOptions) {
  return useQuery({
    queryKey: ['categories', options],
    queryFn: () => getCategories(options),
    select: (data) => data.categories,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (category: CategoryInsert) => createCategory(category),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CategoryUpdate }) =>
      updateCategory(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
