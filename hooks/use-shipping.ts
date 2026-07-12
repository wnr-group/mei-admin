'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getShippingRates,
  createShippingRate,
  updateShippingRate,
  deleteShippingRate,
  getShippingSettings,
  updateShippingSettings,
} from '@/services/shipping'
import type { ShippingSettingsUpdate } from '@/types'

export function useShippingRates() {
  return useQuery({
    queryKey: ['shipping', 'rates'],
    queryFn: () => getShippingRates(),
  })
}

export function useCreateShippingRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ state, charge }: { state: string; charge: number }) =>
      createShippingRate({ state, charge }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipping', 'rates'] }),
  })
}

export function useUpdateShippingRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, state, charge }: { id: string; state?: string; charge?: number }) =>
      updateShippingRate(id, { state, charge }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipping', 'rates'] }),
  })
}

export function useDeleteShippingRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteShippingRate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipping', 'rates'] }),
  })
}

export function useShippingSettings() {
  return useQuery({
    queryKey: ['shipping', 'settings'],
    queryFn: () => getShippingSettings(),
  })
}

export function useUpdateShippingSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: ShippingSettingsUpdate) =>
      updateShippingSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipping', 'settings'] }),
  })
}
