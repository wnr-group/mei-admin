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
  const response = await supabase
    .from('products')
    .insert([product] as never)
    .select()
    .single()
  const { data, error } = response as { data: Product | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Product not returned after insert')

  // Add logging
  await logAuditEvent({
    action: 'CREATE',
    resourceType: 'product',
    resourceId: data.id,
    newData: data as Json,
  })

  return data as Product
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
