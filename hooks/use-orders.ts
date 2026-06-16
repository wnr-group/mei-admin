'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateOrderStatus, deleteOrder } from '@/services/orders'
import type { OrderStatus } from '@/types'

type GetOrdersOptions = Parameters<typeof getOrders>[0]

export function useOrders(options?: GetOrdersOptions) {
  return useQuery({
    queryKey: ['orders', options],
    queryFn: () => getOrders(options),
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
