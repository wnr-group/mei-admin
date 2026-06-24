import { createClient } from '@/lib/supabase/client'
import { toAppError, AppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { Category, CategoryInsert, CategoryUpdate } from '@/types'
import type { Json } from '@/types/database'

interface GetCategoriesOptions {
  page?: number
  limit?: number
}

export async function getCategories(options: GetCategoriesOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 100 } = options

  const { data, error, count } = await supabase
    .from('categories')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) throw toAppError(new Error(error.message))
  return { categories: (data as Category[] | null) ?? [], total: count ?? 0 }
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const supabase = createClient()
  const response = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  const { data, error } = response as { data: Category | null; error: { message: string; code: string } | null }
  if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
  return (data as Category | null) ?? null
}

export async function getCategoryBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
  const supabase = createClient()
  const response = await supabase
    .from('categories')
    .select('id, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  const { data, error } = response as { data: { id: string; slug: string } | null; error: { message: string; code: string } | null }
  if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
  return data ?? null
}

export async function createCategory(category: CategoryInsert) {
  const supabase = createClient()
  const response = await supabase
    .from('categories')
    .insert([category] as never)
    .select()
    .single()
  const { data, error } = response as { data: Category | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category not returned after insert')

  // Add logging
  await logAuditEvent({
    action: 'CREATE',
    resourceType: 'category',
    resourceId: data.id,
    newData: data as Json,
  })

  return data as Category
}

export async function updateCategory(id: string, updates: CategoryUpdate) {
  const supabase = createClient()
  const response = await supabase
    .from('categories')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single()
  const { data, error } = response as { data: Category | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category not returned after update')

  // Add logging
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'category',
    resourceId: id,
    newData: updates as Json,
  })

  return data as Category
}

export async function deleteCategory(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'category',
    resourceId: id,
  })
}
