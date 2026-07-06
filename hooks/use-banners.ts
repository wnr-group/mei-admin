'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBanners, createBanner, updateBanner, deleteBanner, getBannerById } from '@/services/banners'
import type { BannerInsert, BannerUpdate } from '@/types'

type GetBannersOptions = Parameters<typeof getBanners>[0]

export function useBanners(options?: GetBannersOptions) {
  return useQuery({
    queryKey: ['banners', options],
    queryFn: () => getBanners(options),
    select: (data) => data.banners,
  })
}

export function useBanner(id: string) {
  return useQuery({
    queryKey: ['banners', id],
    queryFn: () => getBannerById(id),
    enabled: !!id,
  })
}

export function useCreateBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (banner: BannerInsert) => createBanner(banner),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banners'] }),
  })
}

export function useUpdateBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: BannerUpdate }) =>
      updateBanner(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banners'] }),
  })
}

export function useDeleteBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banners'] }),
  })
}
