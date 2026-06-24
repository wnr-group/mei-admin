'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProductMedia,
  uploadMedia,
  deleteMedia,
} from '@/lib/services/product-media';

export const queryKeys = {
  media: (productId: string, colorId?: string) =>
    ['products', productId, 'media', colorId ?? 'all'] as const,
};

export function useProductMedia(productId: string, colorId?: string) {
  return useQuery({
    queryKey: queryKeys.media(productId, colorId),
    queryFn: () => getProductMedia(productId, colorId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUploadMedia(productId: string, colorId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof uploadMedia>[0]) =>
      uploadMedia(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.media(productId, colorId),
      }),
  });
}

export function useDeleteMedia(productId: string, colorId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMedia(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.media(productId, colorId),
      }),
  });
}
