'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import type { MeasurementFieldKey } from '@/lib/services/measurement-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface TemplateField {
  id: string
  template_id: string
  field_key: MeasurementFieldKey
  is_required: boolean
  sort_order: number
  help_text?: string
  created_at: string
}

const fieldQueryKeys = {
  fields: (templateId: string) => ['mt', templateId, 'fields'] as const,
}

async function getTemplateFields(templateId: string): Promise<TemplateField[]> {
  const { data, error } = await supabase
    .from('measurement_template_fields')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order')
  if (error) throw error
  return data || []
}

async function upsertTemplateField(input: {
  template_id: string
  field_key: MeasurementFieldKey
  is_required?: boolean
  sort_order?: number
  help_text?: string
}): Promise<TemplateField> {
  const { data, error } = await supabase
    .from('measurement_template_fields')
    .upsert(input, { onConflict: 'template_id,field_key' })
    .select()
    .single()
  if (error) throw error
  return data
}

async function deleteTemplateField(id: string): Promise<void> {
  const { error } = await supabase.from('measurement_template_fields').delete().eq('id', id)
  if (error) throw error
}

export function useTemplateFields(templateId: string) {
  return useQuery({
    queryKey: fieldQueryKeys.fields(templateId),
    queryFn: () => getTemplateFields(templateId),
    enabled: !!templateId,
  })
}

export function useUpsertTemplateField(templateId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof upsertTemplateField>[0]) => upsertTemplateField(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fieldQueryKeys.fields(templateId) }),
  })
}

export function useDeleteTemplateField(templateId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTemplateField(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fieldQueryKeys.fields(templateId) }),
  })
}
