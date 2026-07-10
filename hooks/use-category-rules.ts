'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule } from '@/services/category-rules'
import type { CategoryRuleInsert, CategoryRuleUpdate } from '@/types'

const queryKeys = {
  rules: (categoryId: string) => ['categories', categoryId, 'rules'] as const,
}

export function useCategoryRules(categoryId: string) {
  return useQuery({
    queryKey: queryKeys.rules(categoryId),
    queryFn: () => getCategoryRules(categoryId),
    enabled: !!categoryId,
  })
}

export function useCreateCategoryRule(categoryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rule: CategoryRuleInsert) => createCategoryRule(rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules(categoryId) }),
  })
}

export function useUpdateCategoryRule(categoryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CategoryRuleUpdate }) => updateCategoryRule(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules(categoryId) }),
  })
}

export function useDeleteCategoryRule(categoryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategoryRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules(categoryId) }),
  })
}
