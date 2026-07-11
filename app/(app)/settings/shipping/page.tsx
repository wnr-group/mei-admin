'use client'

import React, { useState, useEffect } from 'react'
import {
  useShippingRates,
  useCreateShippingRate,
  useUpdateShippingRate,
  useDeleteShippingRate,
  useShippingSettings,
  useUpdateShippingSettings,
} from '@/hooks/use-shipping'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'

// Mirrors the DB CHECK constraint (charge >= 0 AND charge <= 100000) so the
// admin gets immediate inline feedback instead of a failed-save alert after a
// round trip. The DB constraint remains authoritative — this is UX on top.
const isValidCharge = (raw: string) => {
  if (raw == null || raw.trim() === '') return false
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000
}

// Surface the state-name UNIQUE violation as a readable inline message rather
// than the raw Postgres error text.
const friendlyError = (message: string) => {
  if (/duplicate key|already exists|unique/i.test(message)) {
    return 'That state already has a rate. Edit the existing row instead.'
  }
  return message
}

export default function ShippingSettingsPage() {
  const { data: rates = [], isLoading, error, refetch } = useShippingRates()
  const createRate = useCreateShippingRate()
  const updateRate = useUpdateShippingRate()
  const deleteRate = useDeleteShippingRate()
  const { data: settings, isLoading: settingsLoading } = useShippingSettings()
  const updateSettings = useUpdateShippingSettings()

  // Per-row edit buffers, keyed by row id. Only rows the admin has actually
  // touched appear here; untouched rows render straight from server data, so a
  // background refetch never clobbers an in-progress edit.
  const [edits, setEdits] = useState<Record<string, { state: string; charge: string }>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const [newState, setNewState] = useState('')
  const [newCharge, setNewCharge] = useState('')
  const [addError, setAddError] = useState('')

  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('')

  useEffect(() => {
    if (!settings) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFreeShippingEnabled(settings.free_shipping_enabled)
    setFreeShippingThreshold(
      settings.free_shipping_threshold != null ? String(settings.free_shipping_threshold) : ''
    )
  }, [settings])

  if (isLoading || settingsLoading) return <TableSkeleton rows={8} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const rowState = (id: string, serverState: string) => edits[id]?.state ?? serverState
  const rowCharge = (id: string, serverCharge: number) =>
    edits[id]?.charge ?? String(serverCharge)

  const setRowField = (id: string, serverState: string, serverCharge: number, field: 'state' | 'charge', value: string) => {
    setEdits((prev) => {
      const base = prev[id] ?? { state: serverState, charge: String(serverCharge) }
      return { ...prev, [id]: { ...base, [field]: value } }
    })
    if (rowErrors[id]) setRowErrors((prev) => ({ ...prev, [id]: '' }))
  }

  const isRowDirty = (id: string, serverState: string, serverCharge: number) => {
    const e = edits[id]
    if (!e) return false
    return e.state !== serverState || e.charge !== String(serverCharge)
  }

  const handleSaveRow = async (id: string, serverState: string, serverCharge: number) => {
    const state = rowState(id, serverState).trim()
    const charge = rowCharge(id, serverCharge)

    if (state === '') {
      setRowErrors((prev) => ({ ...prev, [id]: 'State name is required' }))
      return
    }
    if (!isValidCharge(charge)) {
      setRowErrors((prev) => ({ ...prev, [id]: 'Charge must be a number between 0 and 100000' }))
      return
    }

    try {
      await updateRate.mutateAsync({ id, state, charge: Number(charge) })
      setEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: friendlyError(err instanceof Error ? err.message : 'Failed to save'),
      }))
    }
  }

  const handleDeleteRow = async (id: string, state: string) => {
    if (!confirm(`Remove shipping for "${state}"? Customers will no longer be able to select this state at checkout.`)) {
      return
    }
    try {
      await deleteRate.mutateAsync(id)
      setEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: friendlyError(err instanceof Error ? err.message : 'Failed to delete'),
      }))
    }
  }

  const handleAdd = async () => {
    const state = newState.trim()
    if (state === '') {
      setAddError('State name is required')
      return
    }
    if (!isValidCharge(newCharge)) {
      setAddError('Charge must be a number between 0 and 100000')
      return
    }

    try {
      await createRate.mutateAsync({ state, charge: Number(newCharge) })
      setNewState('')
      setNewCharge('')
      setAddError('')
    } catch (err) {
      setAddError(friendlyError(err instanceof Error ? err.message : 'Failed to add state'))
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

  const mutating =
    createRate.isPending || updateRate.isPending || deleteRate.isPending || updateSettings.isPending

  return (
    <div className="space-y-6">
      {mutating && (
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

      {/* Add a state */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs p-6 space-y-4">
        <h4 className="text-[11px] font-bold tracking-widest text-zinc-800 uppercase">
          Add a State
        </h4>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="new-state" className="text-[11px] text-zinc-500 uppercase tracking-widest">
              State / Region
            </label>
            <input
              id="new-state"
              type="text"
              placeholder="e.g. Puducherry"
              value={newState}
              onChange={(e) => {
                setNewState(e.target.value)
                if (addError) setAddError('')
              }}
              className="w-56 border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-charge" className="text-[11px] text-zinc-500 uppercase tracking-widest">
              Charge (₹)
            </label>
            <input
              id="new-charge"
              type="text"
              placeholder="e.g. 300"
              value={newCharge}
              onChange={(e) => {
                setNewCharge(e.target.value)
                if (addError) setAddError('')
              }}
              className="w-32 border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
          <button
            onClick={handleAdd}
            className="bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 px-4 transition-colors uppercase rounded-none"
          >
            Add State
          </button>
        </div>
        {addError && <p className="text-[11px] text-red-500">{addError}</p>}
      </div>

      {/* State-wise rate table */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[45%]">
                  STATE
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[30%]">
                  CHARGE (₹)
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[12px] text-zinc-500">
                    No states configured yet. Add one above to start shipping.
                  </td>
                </tr>
              ) : (
                rates.map((rate) => {
                  const dirty = isRowDirty(rate.id, rate.state, rate.charge)
                  return (
                    <tr key={rate.id} className="hover:bg-[#FAF8F5]/40 transition-colors align-top">
                      <td className="px-6 py-3">
                        <input
                          type="text"
                          aria-label={`State name for ${rate.state}`}
                          value={rowState(rate.id, rate.state)}
                          onChange={(e) => setRowField(rate.id, rate.state, rate.charge, 'state', e.target.value)}
                          className={`w-full border-b py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors ${
                            rowErrors[rate.id] ? 'border-red-500' : 'border-[#E8E0D5]'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="text"
                          aria-label={`Shipping charge for ${rate.state}`}
                          value={rowCharge(rate.id, rate.charge)}
                          onChange={(e) => setRowField(rate.id, rate.state, rate.charge, 'charge', e.target.value)}
                          className={`w-full border-b py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors ${
                            rowErrors[rate.id] ? 'border-red-500' : 'border-[#E8E0D5]'
                          }`}
                        />
                        {rowErrors[rate.id] && (
                          <p className="text-[11px] text-red-500 mt-1">{rowErrors[rate.id]}</p>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveRow(rate.id, rate.state, rate.charge)}
                            disabled={!dirty}
                            className="bg-[#B38B5D] hover:bg-[#A37B4D] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold tracking-widest text-white py-2 px-3 transition-colors uppercase rounded-none"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleDeleteRow(rate.id, rate.state)}
                            className="border border-red-200 hover:bg-red-50 text-[10px] font-bold tracking-widest text-red-500 py-2 px-3 transition-colors uppercase rounded-none"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
