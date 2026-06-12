'use client';

import ColorList from '@/components/products/colors/ColorList'
import VariantTable from '@/components/products/variants/VariantTable'

export default function ColorsVariantsTab({ productId }: { productId: string }) {
  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-6">Colors & Variants</h2>
      <ColorList productId={productId} />
      <VariantTable productId={productId} />
    </div>
  );
}
