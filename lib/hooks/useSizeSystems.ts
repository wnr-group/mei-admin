'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getSizeSystems,
  getSizeSystemEntries,
  type SizeSystem,
  type SizeSystemEntry,
} from '@/lib/services/size-systems';

export const queryKeys = {
  all: () => ['size-systems'] as const,
  entries: (id: string) => ['size-systems', id, 'entries'] as const,
};

export function useSizeSystems() {
  return useQuery({
    queryKey: queryKeys.all(),
    queryFn: getSizeSystems,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSizeSystemEntries(systemId: string) {
  return useQuery({
    queryKey: queryKeys.entries(systemId),
    queryFn: () => getSizeSystemEntries(systemId),
    enabled: !!systemId,
    staleTime: 5 * 60 * 1000,
  });
}
