'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLibraryTemplates,
  getTemplateById,
  getProductOverride,
  createLibraryTemplate,
  renameTemplate,
  softDeleteTemplate,
  getCategoriesUsingTemplate,
  createOverride,
  deleteOverride,
} from '@/lib/services/measurement-templates';

export const queryKeys = {
  library: () => ['measurement_templates', 'library'] as const,
  byId: (id: string) => ['measurement_templates', 'byId', id] as const,
  override: (productId: string) =>
    ['measurement_templates', 'override', productId] as const,
  usedBy: (id: string) => ['measurement_templates', 'usedBy', id] as const,
};

export function useLibraryTemplates() {
  return useQuery({
    queryKey: queryKeys.library(),
    queryFn: getLibraryTemplates,
    staleTime: 60 * 1000,
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: queryKeys.byId(id ?? ''),
    queryFn: () => getTemplateById(id!),
    enabled: !!id,
  });
}

export function useProductOverride(productId: string) {
  return useQuery({
    queryKey: queryKeys.override(productId),
    queryFn: () => getProductOverride(productId),
    enabled: !!productId,
  });
}

export function useCategoriesUsingTemplate(templateId: string | null) {
  return useQuery({
    queryKey: queryKeys.usedBy(templateId ?? ''),
    queryFn: () => getCategoriesUsingTemplate(templateId!),
    enabled: !!templateId,
  });
}

export function useCreateLibraryTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createLibraryTemplate(name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['measurement_templates'] }),
  });
}

export function useRenameTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      renameTemplate(v.id, v.name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['measurement_templates'] }),
  });
}

export function useSoftDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteTemplate(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['measurement_templates'] }),
  });
}

export function useCreateOverride(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceTemplateId: string | null) =>
      createOverride(productId, sourceTemplateId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.override(productId) }),
  });
}

export function useDeleteOverride(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (overrideId: string) => deleteOverride(overrideId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.override(productId) }),
  });
}
