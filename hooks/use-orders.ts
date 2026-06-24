'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, getOrderById, updateOrderStatus, deleteOrder } from '@/services/orders'
import type { OrderStatus } from '@/types'

type GetOrdersOptions = Parameters<typeof getOrders>[0]

export function useOrders(options?: GetOrdersOptions) {
  return useQuery({
    queryKey: ['orders', options],
    queryFn: () => getOrders(options),
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrderById(id),
    enabled: !!id,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', variables.id] })
    },
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
