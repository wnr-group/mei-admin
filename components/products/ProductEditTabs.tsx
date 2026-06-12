'use client';

import { TabsContent } from '@/components/ui/tabs';
import BasicInfoTab from './tabs/BasicInfoTab';
import ColorsVariantsTab from './tabs/ColorsVariantsTab';
import MediaGalleryTab from './tabs/MediaGalleryTab';
import CustomizationTab from './tabs/CustomizationTab';
import MeasurementsTab from './tabs/MeasurementsTab';

export default function ProductEditTabs({ productId, product }: { productId: string; product: any }) {
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
        <CustomizationTab productId={productId} />
      </TabsContent>

      <TabsContent value="measurements">
        <MeasurementsTab productId={productId} />
      </TabsContent>
    </>
  );
}
