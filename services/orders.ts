import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { Order, OrderStatus, OrderWithDetails, OrderDetail } from '@/types'

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
    .select('*, customers(name, email), order_items(quantity)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) throw toAppError(new Error(error.message))
  return { orders: (data as OrderWithDetails[] | null) ?? [], total: count ?? 0 }
}

export async function getOrderById(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(*), order_items(id, product_id, product_name, quantity, unit_price, stitching_type, product_snapshot, products(image_url), order_item_measurements(field_key, label, value_in))')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) throw toAppError(new Error(error.message))
  return data as OrderDetail
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = createClient()
  const response = await supabase
    .from('orders')
    .update({ status } as never)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  const { data, error } = response as { data: Order | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'order',
    resourceId: id,
    newData: { status },
  })

  // Fire-and-forget: enqueue status update notification
  if (supabase.functions) {
    supabase.functions
      .invoke('order-status-notify', { body: { order_id: id, new_status: status } })
      .catch((err) => console.error('order-status-notify invoke failed:', err))
  }

  return data as Order
}

export async function deleteOrder(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  // Only reached on success — failure path throws above
  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'order',
    resourceId: id,
  })
}
