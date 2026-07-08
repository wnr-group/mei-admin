import { createClient } from '@/lib/supabase/client'
import { toAppError, AppError } from '@/lib/errors'
import { OPERATORS_BY_FIELD } from '@/lib/category-rules'
import type { CategoryRule, CategoryRuleInsert, CategoryRuleUpdate } from '@/types'

// Only validates when both field and operator are present together (always true for
// createCategoryRule; for updateCategoryRule a value-only partial update skips this
// and relies on the category_rules_valid_operator_for_field DB CHECK from Task 1).
function assertValidOperatorForField(field?: CategoryRuleInsert['field'], operator?: CategoryRuleInsert['operator']) {
  if (!field || !operator) return
  if (!OPERATORS_BY_FIELD[field].includes(operator)) {
    throw new AppError('VALIDATION_ERROR', `Operator "${operator}" is not valid for field "${field}"`)
  }
}

export async function getCategoryRules(categoryId: string): Promise<CategoryRule[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('category_rules')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true })

  if (error) throw toAppError(new Error(error.message))
  return (data as CategoryRule[] | null) ?? []
}

export async function createCategoryRule(rule: CategoryRuleInsert): Promise<CategoryRule> {
  assertValidOperatorForField(rule.field, rule.operator)
  const supabase = createClient()
  const response = await supabase.from('category_rules').insert([rule] as never).select().single()
  const { data, error } = response as { data: CategoryRule | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category rule not returned after insert')
  return data
}

export async function updateCategoryRule(id: string, updates: CategoryRuleUpdate): Promise<CategoryRule> {
  assertValidOperatorForField(updates.field, updates.operator)
  const supabase = createClient()
  const response = await supabase.from('category_rules').update(updates as never).eq('id', id).select().single()
  const { data, error } = response as { data: CategoryRule | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category rule not returned after update')
  return data
}

export async function deleteCategoryRule(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('category_rules').delete().eq('id', id)
  if (error) throw toAppError(new Error(error.message))
}
