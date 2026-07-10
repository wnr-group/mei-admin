'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  useShippingRates,
  useUpsertShippingRate,
  useShippingSettings,
  useUpdateShippingSettings,
} from '@/hooks/use-shipping'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { indianStates } from '@/lib/india-states'

export default function ShippingSettingsPage() {
  const { data: rates = [], isLoading, error, refetch } = useShippingRates()
  const upsertRate = useUpsertShippingRate()
  const { data: settings, isLoading: settingsLoading } = useShippingSettings()
  const updateSettings = useUpdateShippingSettings()

  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('')

  // Tracks the value we last synced into formValues from the server, per
  // state. A refetch (e.g. refetchOnWindowFocus, or another admin's save)
  // must not clobber a row the admin is actively editing — only rows whose
  // current form value still matches what we last synced are "clean" and
  // safe to overwrite with fresh server data.
  const lastSyncedRef = useRef<Record<string, string>>({})

  useEffect(() => {
    // Snapshot before overwriting the ref — the setFormValues updater below
    // may run after this line, so it must close over the OLD synced values
    // rather than read the ref (which would already hold the new ones).
    const previousSynced = lastSyncedRef.current
    const nextSynced: Record<string, string> = {}
    indianStates.forEach((state) => {
      const existing = rates.find((r) => r.state === state)
      nextSynced[state] = existing ? String(existing.charge) : ''
    })
    lastSyncedRef.current = nextSynced

    setFormValues((prev) => {
      const values: Record<string, string> = { ...prev }
      let hasChanges = false
      indianStates.forEach((state) => {
        const chargeStr = nextSynced[state]
        const isDirty = prev[state] !== undefined && prev[state] !== previousSynced[state]
        if (!isDirty && prev[state] !== chargeStr) {
          values[state] = chargeStr
          hasChanges = true
        }
      })
      return hasChanges ? values : prev
    })
  }, [rates])

  useEffect(() => {
    if (!settings) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFreeShippingEnabled(settings.free_shipping_enabled)
    setFreeShippingThreshold(settings.free_shipping_threshold != null ? String(settings.free_shipping_threshold) : '')
  }, [settings])

  if (isLoading || settingsLoading) return <TableSkeleton rows={8} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const originalByState = new Map(rates.map((r) => [r.state, String(r.charge)]))

  const handleChargeChange = (state: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [state]: value }))
    if (rowErrors[state]) {
      setRowErrors((prev) => ({ ...prev, [state]: '' }))
    }
  }

  // Mirrors the DB CHECK constraint (charge >= 0 AND charge <= 100000) so the
  // admin gets immediate inline feedback instead of a generic failed-save
  // alert after a round trip. The DB constraint remains the authoritative
  // guard — this is a UX improvement layered on top of it, not a replacement.
  const isValidCharge = (raw: string) => {
    if (raw === undefined || raw === null || raw.trim() === '') return false
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000
  }

  const handleSaveRates = async () => {
    const dirtyStates = indianStates.filter((state) => {
      const original = originalByState.get(state) ?? ''
      return formValues[state] !== original
    })

    const nextRowErrors: Record<string, string> = {}
    const validStates = dirtyStates.filter((state) => {
      if (!isValidCharge(formValues[state])) {
        nextRowErrors[state] = 'Enter a number between 0 and 100000'
        return false
      }
      return true
    })
    setRowErrors(nextRowErrors)
    if (validStates.length === 0) return

    try {
      for (const state of validStates) {
        await upsertRate.mutateAsync({ state, charge: Number(formValues[state]) })
      }
    } catch {
      alert('Failed to save shipping rates')
    }
  }

  const handleSaveFreeShipping = async () => {
    const parsedThreshold = freeShippingThreshold.trim() === '' ? null : Number(freeShippingThreshold)
    if (parsedThreshold !== null && (!Number.isFinite(parsedThreshold) || parsedThreshold < 0)) {
      alert('Threshold must be a non-negative number')
      return
    }

    try {
      await updateSettings.mutateAsync({
        free_shipping_enabled: freeShippingEnabled,
        free_shipping_threshold: parsedThreshold,
      })
    } catch {
      alert('Failed to save free shipping rule')
    }
  }

  return (
    <div className="space-y-6">
      {(upsertRate.isPending || updateSettings.isPending) && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving shipping settings...</div>
        </div>
      )}

      {/* Free shipping rule */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs p-6 space-y-4">
        <h4 className="text-[11px] font-bold tracking-widest text-zinc-800 uppercase">
          Free Shipping Rule
        </h4>
        <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={freeShippingEnabled}
            onChange={(e) => setFreeShippingEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <span>Enable free shipping above a threshold</span>
        </label>
        <div className="flex items-center gap-3">
          <label htmlFor="free-shipping-threshold" className="text-[11px] text-zinc-500 uppercase tracking-widest">
            Threshold (₹)
          </label>
          <input
            id="free-shipping-threshold"
            type="number"
            min={0}
            value={freeShippingThreshold}
            onChange={(e) => setFreeShippingThreshold(e.target.value)}
            disabled={!freeShippingEnabled}
            className="w-32 border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors disabled:opacity-40"
          />
        </div>
        <button
          onClick={handleSaveFreeShipping}
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 px-4 transition-colors uppercase rounded-none"
        >
          Save Free Shipping Rule
        </button>
      </div>

      {/* State-wise rate table */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[50%]">
                  STATE
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[50%]">
                  CHARGE (₹)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {indianStates.map((state) => (
                <tr key={state} className="hover:bg-[#FAF8F5]/40 transition-colors">
                  <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">{state}</td>
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      min={0}
                      max={100000}
                      placeholder="Not set"
                      aria-label={`Shipping charge for ${state}`}
                      value={formValues[state] ?? ''}
                      onChange={(e) => handleChargeChange(state, e.target.value)}
                      className={`w-full border-b py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors ${
                        rowErrors[state] ? 'border-red-500' : 'border-[#E8E0D5]'
                      }`}
                    />
                    {rowErrors[state] && <p className="text-[11px] text-red-500 mt-1">{rowErrors[state]}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#E8E0D5] px-8 py-5 flex gap-3 bg-[#FAF8F5]/30">
          <button
            onClick={handleSaveRates}
            className="bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 px-4 transition-colors uppercase rounded-none"
          >
            Save All Changes
          </button>
        </div>
      </div>
    </div>
  )
}
