'use client'

import { useState, useRef } from 'react'
import { useBlouseConfig, useUpsertBlouseConfig } from '@/lib/hooks/useBlouseConfig'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import StitchingOptionsSelector from './StitchingOptionsSelector'
import TemplateMappingSelector from './TemplateMappingSelector'
import type { CustomizationType } from '@/lib/services/blouse-config'

interface Props {
  productId: string
  customizationType?: CustomizationType
}

export default function BlouseConfigurationCard({ productId, customizationType }: Props) {
  const { data: config, isLoading, error, refetch } = useBlouseConfig(productId, customizationType)
  const upsert = useUpsertBlouseConfig(productId)

  const [includesBlouse, setIncludesBlouse] = useState(true)
  const [stitchingOptions, setStitchingOptions] = useState<string[]>(['STITCHED', 'UNSTITCHED'])
  const [templateId, setTemplateId] = useState<string | undefined>()

  const prevConfigRef = useRef(config)
  // eslint-disable-next-line react-hooks/refs -- derived state pattern: compare ref to detect prop changes
  if (config !== prevConfigRef.current) {
    // eslint-disable-next-line react-hooks/refs -- derived state pattern: update ref to track changes
    prevConfigRef.current = config
    if (config) {
      setIncludesBlouse(config.includes_blouse)
      setStitchingOptions(config.stitching_options ?? ['STITCHED', 'UNSTITCHED'])
      setTemplateId(config.blouse_measurement_template_id ?? undefined)
    }
  }

  async function handleSave() {
    await upsert.mutateAsync({
      product_id: productId,
      customization_type: customizationType,
      includes_blouse: includesBlouse,
      stitching_options: stitchingOptions,
    })
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (error) return <ErrorState message="Could not load blouse configuration." onRetry={refetch} />

  const label = customizationType
    ? { SEMI_STITCHED: 'Semi Stitched', STANDARD_SIZE: 'Standard Size', CUSTOM_TAILORED: 'Custom Tailored', UNSTITCHED: 'Unstitched' }[customizationType]
    : 'All Types'

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-4">{label}</h4>
      <div className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includesBlouse} onChange={e => setIncludesBlouse(e.target.checked)} className="accent-[#c9a465]" />
          <span className="text-sm font-medium">Includes Blouse</span>
        </label>
        {includesBlouse && (
          <>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Stitching Options</p>
              <StitchingOptionsSelector value={stitchingOptions} onChange={setStitchingOptions} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Blouse Measurement Template</p>
              <TemplateMappingSelector value={templateId} onChange={setTemplateId} />
            </div>
          </>
        )}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={upsert.isPending} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
            {upsert.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {upsert.error && <p className="text-xs text-red-600 text-right">Failed to save.</p>}
      </div>
    </div>
  )
}
