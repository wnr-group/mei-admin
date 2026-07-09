'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getShippingRates,
  upsertShippingRate,
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

export function useUpsertShippingRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ state, charge }: { state: string; charge: number }) =>
      upsertShippingRate({ state, charge }),
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
