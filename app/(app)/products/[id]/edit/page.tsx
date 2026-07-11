'use client';

import { useParams } from 'next/navigation';
import ProductForm from '@/components/products/ProductForm';

export default function ProductEditPage() {
  const params = useParams();
  const productId = params.id as string;

  return <ProductForm editId={productId} />;
}
