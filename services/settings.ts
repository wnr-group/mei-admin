import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import type { Setting } from '@/types'

export async function getSettings() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('settings')
    .select('*')

  if (error) throw toAppError(new Error(error.message))
  return (data as Setting[] | null) ?? []
}

export async function updateSetting(key: string, value: unknown) {
  const supabase = createClient()
  const response = await supabase
    .from('settings')
    .update({ value } as never)
    .eq('key', key)
    .select()
    .single()
  const { data, error } = response as { data: Setting | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  return data as Setting
}
