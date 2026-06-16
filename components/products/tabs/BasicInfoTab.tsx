'use client';

export default function BasicInfoTab({ productId, product }: { productId: string; product: unknown }) {
  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
      <p className="text-gray-600">Tab content coming in Phase 3</p>
    </div>
  );
}
