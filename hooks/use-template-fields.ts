'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createUntypedClient } from '@/lib/supabase/client'
import type { MeasurementFieldKey } from '@/lib/services/measurement-templates'

const supabase = createUntypedClient()

export interface TemplateField {
  id: string
  template_id: string
  field_key: MeasurementFieldKey
  label?: string | null
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
  id?: string
  template_id: string
  field_key: MeasurementFieldKey
  label?: string | null
  is_required?: boolean
  sort_order?: number
  help_text?: string
}): Promise<TemplateField> {
  const table = supabase.from('measurement_template_fields')
  // Editing an existing row (e.g. toggling required) → update by id.
  // Otherwise it's a new field → insert. We can't ON CONFLICT upsert here:
  // uniqueness is enforced by two *partial* indexes (fixed keys vs custom
  // labels), which Postgres won't accept as a conflict target. Callers add a
  // field only when it isn't already present, so a plain insert is correct.
  let query
  if (input.id) {
    const { id, ...rest } = input
    query = table.update(rest).eq('id', id)
  } else {
    query = table.insert(input)
  }
  const { data, error } = await query.select().single()
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
