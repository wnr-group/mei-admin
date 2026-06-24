'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBlouseConfig,
  upsertBlouseConfig,
  type CustomizationType,
} from '@/lib/services/blouse-config';

export const queryKeys = {
  config: (productId: string, customizationType?: CustomizationType) =>
    [
      'products',
      productId,
      'blouse-config',
      customizationType ?? 'all',
    ] as const,
};

export function useBlouseConfig(
  productId: string,
  customizationType?: CustomizationType
) {
  return useQuery({
    queryKey: queryKeys.config(productId, customizationType),
    queryFn: () => getBlouseConfig(productId, customizationType),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpsertBlouseConfig(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof upsertBlouseConfig>[0]) =>
      upsertBlouseConfig(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.config(productId),
      }),
  });
}
