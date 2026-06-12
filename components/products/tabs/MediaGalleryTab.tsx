'use client';

import MediaGallery from '@/components/products/media/MediaGallery'

export default function MediaGalleryTab({ productId }: { productId: string }) {
  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Media Gallery</h2>
      <MediaGallery productId={productId} />
    </div>
  );
}
