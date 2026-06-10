'use client';

import React, { use } from 'react';
import BannerForm from '@/components/banners/BannerForm';

export default function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BannerForm editId={id} />;
}
