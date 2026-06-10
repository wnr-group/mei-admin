'use client';

import React, { use } from 'react';
import ProductForm from '@/components/products/ProductForm';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProductForm editId={id} />;
}
