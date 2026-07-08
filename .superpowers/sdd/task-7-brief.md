### Task 7: React Query hooks

**Files:**
- Create: `hooks/use-category-rules.ts`
- Create: `hooks/use-product-categories.ts`

**Interfaces:**
- Consumes: `getCategoryRules`, `createCategoryRule`, `updateCategoryRule`, `deleteCategoryRule` from `@/services/category-rules` (Task 4); `reevaluateAllProducts` from `@/services/product-categories` (Task 5); `CategoryRuleInsert`, `CategoryRuleUpdate` from `@/types`.
- Produces: `useCategoryRules(categoryId)`, `useCreateCategoryRule(categoryId)`, `useUpdateCategoryRule(categoryId)`, `useDeleteCategoryRule(categoryId)`, `useReevaluateAllProducts()`. Relied on by Task 8's components.

- [ ] **Step 1: Write `hooks/use-category-rules.ts`**

```ts
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
```

- [ ] **Step 2: Write `hooks/use-product-categories.ts`**

```ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { reevaluateAllProducts } from '@/services/product-categories'

export function useReevaluateAllProducts() {
  return useMutation({
    mutationFn: () => reevaluateAllProducts(),
  })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (These hooks are exercised end-to-end by Task 8's component tests, matching the existing convention where `hooks/use-product-colors.ts` has no dedicated test file.)

- [ ] **Step 4: Commit**

```bash
git add hooks/use-category-rules.ts hooks/use-product-categories.ts
git commit -m "feat(category-rules): add React Query hooks for category rules and re-evaluation"
```

---

