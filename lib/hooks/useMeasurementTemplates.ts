'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTemplates,
  createTemplate,
  type CustomizationType,
} from '@/lib/services/measurement-templates';

export const queryKeys = {
  templates: () => ['measurement_templates'] as const,
};

export function useTemplates(filters?: {
  categoryId?: string;
  productId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.templates(),
    queryFn: () => getTemplates(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createTemplate>[0]) =>
      createTemplate(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.templates() }),
  });
}
