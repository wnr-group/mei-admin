import { createClient } from '@/lib/supabase/client'
import type { Order, OrderUpdate, OrderStatus } from '@/types'

interface GetOrdersOptions {
  page?: number
  limit?: number
  status?: OrderStatus
}

export async function getOrders(options: GetOrdersOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, status } = options

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) throw new Error(error.message)
  return { orders: (data as Order[] | null) ?? [], total: count ?? 0 }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = createClient()
  const response = await supabase
    .from('orders')
    .update({ status } as never)
    .eq('id', id)
    .select()
    .single()
  const { data, error } = response as { data: Order | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data as Order
}
