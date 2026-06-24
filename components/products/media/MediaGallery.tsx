'use client'

import { useState } from 'react'
import { useProductColors } from '@/hooks/use-product-colors'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import MediaGrid from './MediaGrid'

interface Props {
  productId: string
}

export default function MediaGallery({ productId }: Props) {
  const { data: colors } = useProductColors(productId)
  const [activeTab, setActiveTab] = useState('all')

  return (
    <div>
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Media</TabsTrigger>
          {colors?.map(c => (
            <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="all">
          <MediaGrid productId={productId} />
        </TabsContent>
        {colors?.map(c => (
          <TabsContent key={c.id} value={c.id}>
            <MediaGrid productId={productId} colorId={c.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
