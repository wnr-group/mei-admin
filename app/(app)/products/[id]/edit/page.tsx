'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductEditTabs from '@/components/products/ProductEditTabs';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';

const supabase = createClient();

export default function ProductEditPage() {
  const params = useParams();
  const productId = params.id as string;

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['products', productId],
    queryFn: async () => {
      const response = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      const { data, error } = response as { data: Product | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      return data;
    }
  });

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error || !product) return <div className="p-8">Product not found</div>;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        <p className="text-sm text-gray-600 mt-1">Edit product details, colors, variants, and customization</p>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="colors">Colors & Variants</TabsTrigger>
          <TabsTrigger value="media">Media Gallery</TabsTrigger>
          <TabsTrigger value="customization">Customization</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
        </TabsList>

        <ProductEditTabs productId={productId} product={product} />
      </Tabs>
    </div>
  );
}
