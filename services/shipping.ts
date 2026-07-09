import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { ShippingRate, ShippingSettings, ShippingRateInsert, ShippingSettingsUpdate } from '@/types'
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

export async function upsertShippingRate(rate: { state: string; charge: number }) {
  const supabase = createClient()

  const response = await supabase
    .from('shipping_rates')
    .upsert(
      [{ state: rate.state, charge: rate.charge }] as never,
      { onConflict: 'state' }
    )
    .select()
    .single()

  const { data, error } = response as { data: ShippingRate | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'shipping_rate',
    resourceId: rate.state,
    newData: { state: rate.state, charge: rate.charge } as Json,
  })

  return data as ShippingRate
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
