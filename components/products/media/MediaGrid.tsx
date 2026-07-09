'use client'

import { useProductMedia, useDeleteMedia } from '@/lib/hooks/useProductMedia'
import { useSetPrimaryMedia } from '@/hooks/use-set-primary-media'
import { useReorderMedia } from '@/hooks/use-reorder-media'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import MediaCard from './MediaCard'
import MediaUploader from './MediaUploader'
import type { ProductMedia } from '@/lib/services/product-media'

interface Props {
  productId: string
  colorId?: string
}

export default function MediaGrid({ productId, colorId }: Props) {
  const { data: media, isLoading, error, refetch } = useProductMedia(productId, colorId)
  const deleteMedia = useDeleteMedia(productId, colorId)
  const setPrimary = useSetPrimaryMedia(productId, colorId)
  const reorder = useReorderMedia(productId, colorId)

  function moveItem(index: number, direction: -1 | 1) {
    if (!media) return
    const newOrder = [...media]
    const [item] = newOrder.splice(index, 1)
    newOrder.splice(index + direction, 0, item)
    const updates = newOrder.map((m: ProductMedia, i: number) => ({ id: m.id, sort_order: i }))
    reorder.mutate(updates)
  }

  return (
    <div className="space-y-4">
      <MediaUploader productId={productId} colorId={colorId} />
      {isLoading && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-square rounded-lg" />)}
        </div>
      )}
      {error && <ErrorState message="Could not load media." onRetry={refetch} />}
      {!isLoading && !error && media?.length === 0 && <EmptyState message="No media yet. Add an image URL above." />}
      {!isLoading && !error && media && media.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {media.map((m, i) => (
            <MediaCard
              key={m.id}
              media={m}
              isFirst={i === 0}
              isLast={i === media.length - 1}
              onDelete={id => deleteMedia.mutate(id)}
              onSetPrimary={id => setPrimary.mutate(id)}
              onMoveUp={() => moveItem(i, -1)}
              onMoveDown={() => moveItem(i, 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
