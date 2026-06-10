'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSetting } from '@/services/settings'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings(),
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      updateSetting(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
