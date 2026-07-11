'use client'

import React, { useState, useEffect } from 'react'
import { useSettings, useUpdateSetting } from '@/hooks/use-settings'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Setting } from '@/types'

export default function SettingsPage() {
  const { data: settings = [], isLoading, error, refetch } = useSettings()
  const updateSettingMutation = useUpdateSetting()

  const [formValues, setFormValues] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (settings.length === 0) return
    const values: Record<string, unknown> = {}
    settings.forEach((setting) => { values[setting.key] = setting.value })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormValues(values)
  }, [settings])

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (settings.length === 0) return <EmptyState message="No settings configured." />
  // formValues is populated by useEffect after the first render with data.
  // Guard here so inputs never receive `undefined` as their value.
  if (Object.keys(formValues).length === 0) return <TableSkeleton rows={6} />

  const handleFieldChange = (key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (setting: Setting) => {
    const newValue = formValues[setting.key]
    if (newValue === setting.value) return

    try {
      await updateSettingMutation.mutateAsync({ key: setting.key, value: newValue })
    } catch {
      alert('Failed to update setting')
    }
  }

  return (
    <>
      {/* Loading overlay for mutations */}
      {updateSettingMutation.isPending && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving settings...</div>
        </div>
      )}

      {/* Settings Table */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                  KEY
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[40%]">
                  VALUE
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[35%]">
                  DESCRIPTION
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {settings.map((setting) => {
                const currentValue = formValues[setting.key]

                return (
                  <tr key={setting.key} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                      {setting.key}
                    </td>
                    <td className="px-6 py-3 space-y-2">
                      {typeof setting.value === 'boolean' ? (
                        <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentValue as boolean}
                            onChange={(e) => handleFieldChange(setting.key, e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span>{currentValue ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      ) : typeof setting.value === 'number' ? (
                        <input
                          type="number"
                          value={currentValue as number}
                          onChange={(e) => handleFieldChange(setting.key, parseInt(e.target.value, 10))}
                          className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(currentValue)}
                          onChange={(e) => handleFieldChange(setting.key, e.target.value)}
                          className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                        />
                      )}
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-600">
                      {setting.description ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#E8E0D5] px-8 py-5 flex gap-3 bg-[#FAF8F5]/30">
          <button
            onClick={() => {
              // Reset form values to original
              const values: Record<string, unknown> = {}
              settings.forEach((setting) => {
                values[setting.key] = setting.value
              })
              setFormValues(values)
            }}
            className="border border-zinc-200 hover:bg-zinc-50 text-[10px] font-bold tracking-widest text-zinc-500 py-2 px-4 transition-colors uppercase rounded-none"
          >
            Reset
          </button>
          <button
            onClick={() => {
              // Save all dirty fields
              const dirtySettings = settings.filter((s) => formValues[s.key] !== s.value)
              dirtySettings.forEach((setting) => {
                handleSave(setting)
              })
            }}
            className="bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 px-4 transition-colors uppercase rounded-none"
          >
            Save All Changes
          </button>
        </div>

      </div>

    </>
  )
}
