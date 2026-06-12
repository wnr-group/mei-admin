'use client';

import MeasurementTemplateSelector from '@/components/products/measurements/MeasurementTemplateSelector'

export default function MeasurementsTab({ productId }: { productId: string }) {
  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Measurements</h2>
      <MeasurementTemplateSelector productId={productId} />
    </div>
  );
}
