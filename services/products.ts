import { createClient } from '@/lib/supabase/client'
import { toAppError, AppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { Product, ProductInsert, ProductUpdate } from '@/types'
import type { Json } from '@/types/database'

interface GetProductsOptions {
  page?: number
  limit?: number
  search?: string
  status?: 'PUBLISHED' | 'DRAFT'
  categoryId?: string
}

export async function getProducts(options: GetProductsOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, search, status, categoryId } = options

  let query = supabase
    .from('products')
    .select('*, categories(id, name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error, count } = await query
  if (error) throw toAppError(new Error(error.message))
  return { products: data as Product[] | null ?? [], total: count ?? 0 }
}

export async function createProduct(product: ProductInsert) {
  const supabase = createClient()

  // No slug provided — simple insert, no disambiguation needed
  if (!product.slug) {
    const response = await supabase
      .from('products')
      .insert([product] as never)
      .select()
      .single()
    const { data, error } = response as { data: Product | null; error: { message: string } | null }
    if (error) throw toAppError(new Error(error.message))
    if (!data) throw new AppError('NOT_FOUND', 'Product not returned after insert')
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }

  const baseSlug = product.slug
  for (let attempt = 1; attempt <= 20; attempt++) {
    const candidateSlug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`

    // Pre-check: skip this candidate without hitting the constraint if it's obviously taken
    const existing = await getProductBySlug(candidateSlug)
    if (existing) continue

    const response = await supabase
      .from('products')
      .insert([{ ...product, slug: candidateSlug }] as never)
      .select()
      .single()
    const { data, error } = response as { data: Product | null; error: { message: string; code?: string } | null }

    if (error) {
      // Race condition: another concurrent request inserted the same slug between our pre-check and insert
      if (isUniqueSlugViolation(error)) continue
      throw toAppError(new Error(error.message))
    }
    if (!data) throw new AppError('NOT_FOUND', 'Product not returned after insert')

    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }

  throw new AppError('VALIDATION_ERROR', 'Unable to generate a unique product slug. Please try again.')
}

export async function updateProduct(id: string, updates: ProductUpdate) {
  const supabase = createClient()
  const response = await supabase
    .from('products')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single()
  const { data, error } = response as { data: Product | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Product not returned after update')

  // Add logging
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'product',
    resourceId: id,
    newData: updates as Json,
  })

  return data as Product
}

export async function getProductById(id: string): Promise<Product | null> {
  const supabase = createClient()
  const response = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  const { data, error } = response as { data: Product | null; error: { message: string } | null }
  if (error) {
    if (error.message.toLowerCase().includes('no rows')) return null
    throw toAppError(new Error(error.message))
  }
  return data
}

export async function getProductBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
  const supabase = createClient()
  const response = await supabase
    .from('products')
    .select('id, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  const { data, error } = response as { data: { id: string; slug: string } | null; error: { message: string; code: string } | null }
  if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
  return data ?? null
}

function isUniqueSlugViolation(error: { message: string; code?: string }): boolean {
  return error.code === '23505' || error.message.includes('products_slug_unique')
}

export async function deleteProduct(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'product',
    resourceId: id,
  })
}
