import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { evaluateCategoryRules, type RuleInput } from '@/lib/category-rules'
import type { CategoryMatchType, ProductCategorySource } from '@/types'

export interface RuleEvaluableProductRow {
  id: string
  name: string
  work_types: string[]
  price: number
  category_id: string | null
}

interface CategoryWithRules {
  id: string
  rule_match_type: CategoryMatchType
  category_rules: RuleInput[]
}

async function getCategoriesWithRules(): Promise<CategoryWithRules[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, rule_match_type, category_rules(field, operator, value)')
    .is('deleted_at', null)

  if (error) throw toAppError(new Error(error.message))
  return ((data as unknown as CategoryWithRules[] | null) ?? []).filter(
    (c) => (c.category_rules ?? []).length > 0
  )
}

async function reconcileSource(
  productId: string,
  source: ProductCategorySource,
  desiredCategoryIds: string[]
): Promise<void> {
  const supabase = createClient()

  const { data: existingRows, error: readError } = await supabase
    .from('product_categories')
    .select('id, category_id')
    .eq('product_id', productId)
    .eq('source', source)
  if (readError) throw toAppError(new Error(readError.message))

  const rows = (existingRows as { id: string; category_id: string }[] | null) ?? []
  const existingIds = new Set(rows.map((r) => r.category_id))
  const desiredIds = new Set(desiredCategoryIds)

  const toInsert = desiredCategoryIds.filter((id) => !existingIds.has(id))
  const staleRowIds = rows.filter((r) => !desiredIds.has(r.category_id)).map((r) => r.id)

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('product_categories')
      .insert(toInsert.map((category_id) => ({ product_id: productId, category_id, source })) as never)
    // 23505 = unique_violation: another concurrent save already inserted this pair — safe to ignore
    if (error && error.code !== '23505') throw toAppError(new Error(error.message))
  }

  if (staleRowIds.length > 0) {
    const { error } = await supabase.from('product_categories').delete().in('id', staleRowIds)
    if (error) throw toAppError(new Error(error.message))
  }
}

// Reconciles ONLY source='rule' rows against current rule matches. Never reads
// or writes source='manual' rows — safe to call in bulk from reevaluateAllProducts
// without disturbing anyone's manual category assignment.
export async function syncRuleCategoryAssignments(product: RuleEvaluableProductRow): Promise<void> {
  const categoriesWithRules = await getCategoriesWithRules()
  const matchedCategoryIds = categoriesWithRules
    .filter((c) => evaluateCategoryRules(product, c.category_rules, c.rule_match_type))
    .map((c) => c.id)

  await reconcileSource(product.id, 'rule', matchedCategoryIds)
}

// Reconciles ONLY the single source='manual' row against the product's current
// category_id. Never reads or writes source='rule' rows.
export async function syncManualCategoryAssignment(product: RuleEvaluableProductRow): Promise<void> {
  await reconcileSource(product.id, 'manual', product.category_id ? [product.category_id] : [])
}

// Full sync used on every product create/update (Task 6) — runs both reconciliations.
export async function syncProductCategoryAssignments(product: RuleEvaluableProductRow): Promise<void> {
  await syncRuleCategoryAssignments(product)
  await syncManualCategoryAssignment(product)
}

// Bulk re-evaluation. Per the locked reconciliation rule, this rebuilds ONLY
// rule-based assignments across every product — it must never touch manual rows,
// so it calls syncRuleCategoryAssignments directly, not the full sync.
export async function reevaluateAllProducts(): Promise<{ evaluated: number }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, work_types, price, category_id')
    .is('deleted_at', null)
  if (error) throw toAppError(new Error(error.message))

  const products = (data as RuleEvaluableProductRow[] | null) ?? []
  for (const product of products) {
    await syncRuleCategoryAssignments(product)
  }
  return { evaluated: products.length }
}
