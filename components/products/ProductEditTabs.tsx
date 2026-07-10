'use client';

import { TabsContent } from '@/components/ui/tabs';
import BasicInfoTab from './tabs/BasicInfoTab';
import ColorsVariantsTab from './tabs/ColorsVariantsTab';
import MediaGalleryTab from './tabs/MediaGalleryTab';
import CustomizationTab from './tabs/CustomizationTab';
import MeasurementsTab from './tabs/MeasurementsTab';

interface EditableProduct {
  price_unstitched: number | null
  price_stitched: number | null
}

export default function ProductEditTabs({ productId, product }: { productId: string; product: EditableProduct }) {
  return (
    <>
      <TabsContent value="basic">
        <BasicInfoTab productId={productId} product={product} />
      </TabsContent>

      <TabsContent value="colors">
        <ColorsVariantsTab productId={productId} />
      </TabsContent>

      <TabsContent value="media">
        <MediaGalleryTab productId={productId} />
      </TabsContent>

      <TabsContent value="customization">
        <CustomizationTab productId={productId} product={product} />
      </TabsContent>

      <TabsContent value="measurements">
        <MeasurementsTab productId={productId} />
      </TabsContent>
    </>
  );
}
