// components/products/tabs/CustomizationTab.tsx
'use client';

import { useState } from 'react'
import BlouseConfigurationCard from '@/components/products/customization/BlouseConfigurationCard'
import SizeSystemSelector from '@/components/products/sizes/SizeSystemSelector'

export default function CustomizationTab({ productId, product }: { productId: string; product: { price_unstitched: number | null; price_stitched: number | null } }) {
  const [sizeSystemId, setSizeSystemId] = useState<string | undefined>()

  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Customization</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Size System</h3>
            <SizeSystemSelector value={sizeSystemId} onChange={setSizeSystemId} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Blouse Configuration</h3>
            <BlouseConfigurationCard productId={productId} availableStitchingOptions={
              [
                ...(product.price_unstitched != null ? ['UNSTITCHED'] : []),
                ...(product.price_stitched != null ? ['STITCHED'] : []),
              ]
            } />
          </div>
        </div>
      </div>
    </div>
  );
}
