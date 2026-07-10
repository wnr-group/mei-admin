'use client'

import { useMutation } from '@tanstack/react-query'
import { reevaluateAllProducts } from '@/services/product-categories'

export function useReevaluateAllProducts() {
  return useMutation({
    mutationFn: () => reevaluateAllProducts(),
  })
}
