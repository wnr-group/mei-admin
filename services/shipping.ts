import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { ShippingRate, ShippingSettings, ShippingSettingsUpdate } from '@/types'
import type { Json } from '@/types/database'

export async function getShippingRates() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shipping_rates')
    .select('*')
    .order('state', { ascending: true })

  if (error) throw toAppError(new Error(error.message))
  return (data as ShippingRate[] | null) ?? []
}

export async function createShippingRate(rate: { state: string; charge: number }) {
  const supabase = createClient()

  const response = await supabase
    .from('shipping_rates')
    .insert([{ state: rate.state, charge: rate.charge }] as never)
    .select()
    .single()

  const { data, error } = response as { data: ShippingRate | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'CREATE',
    resourceType: 'shipping_rate',
    resourceId: (data as ShippingRate).id,
    newData: { state: rate.state, charge: rate.charge } as Json,
  })

  return data as ShippingRate
}

// Update by primary-key id (not state name) so a rename is a single row edit
// rather than an orphan-and-recreate. `state` is UNIQUE, so renaming to an
// existing state surfaces as a DB unique-violation the caller can show inline.
export async function updateShippingRate(id: string, patch: { state?: string; charge?: number }) {
  const supabase = createClient()

  const response = await supabase
    .from('shipping_rates')
    .update(patch as never)
    .eq('id', id)
    .select()
    .single()

  const { data, error } = response as { data: ShippingRate | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'shipping_rate',
    resourceId: id,
    newData: patch as Json,
  })

  return data as ShippingRate
}

export async function deleteShippingRate(id: string) {
  const supabase = createClient()

  const { error } = await supabase.from('shipping_rates').delete().eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'shipping_rate',
    resourceId: id,
  })
}

export async function getShippingSettings() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shipping_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw toAppError(new Error(error.message))
  return data as ShippingSettings
}

export async function updateShippingSettings(
  settings: ShippingSettingsUpdate
) {
  const supabase = createClient()

  const response = await supabase
    .from('shipping_settings')
    .update(settings as never)
    .eq('id', 1)
    .select()
    .single()

  const { data, error } = response as { data: ShippingSettings | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'shipping_settings',
    resourceId: '1',
    newData: settings as Json,
  })

  return data as ShippingSettings
}
