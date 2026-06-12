'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, getOrderById, updateOrderStatus } from '@/services/orders'
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
    queryKey: ['orders', id],
    queryFn: () => getOrderById(id),
    enabled: !!id,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['orders', variables.id] })
    },
  })
}
