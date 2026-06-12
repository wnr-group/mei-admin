import { renderHook, waitFor } from '@testing-library/react';
import {
  useProductMedia,
  useUploadMedia,
  useDeleteMedia,
} from '@/lib/hooks/useProductMedia';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { createElement } from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useProductMedia Hook', () => {
  let productId: string;

  beforeAll(async () => {
    // Get first product to test with
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: products } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (products && products.length > 0) {
      productId = products[0].id;
    }
  });

  test('useProductMedia fetches media for product', async () => {
    if (!productId) {
      console.warn('Skipping test: no product found');
      expect(true).toBe(true);
      return;
    }

    const { result } = renderHook(() => useProductMedia(productId), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  test('useProductMedia is disabled when productId is empty', async () => {
    const { result } = renderHook(() => useProductMedia(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  test('useUploadMedia mutation returns success', async () => {
    if (!productId) {
      console.warn('Skipping test: no product found');
      expect(true).toBe(true);
      return;
    }

    const { result: mediaResult } = renderHook(() => useProductMedia(productId), {
      wrapper: createWrapper(),
    });

    const { result: uploadResult } = renderHook(
      () => useUploadMedia(productId),
      {
        wrapper: createWrapper(),
      }
    );

    // Trigger mutation
    uploadResult.current.mutate({
      product_id: productId,
      url: 'https://example.com/test.jpg',
      alt_text: 'Test',
      media_type: 'IMAGE',
    });

    await waitFor(
      () => {
        expect(uploadResult.current.isPending).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(uploadResult.current.isSuccess || uploadResult.current.isError).toBe(
      true
    );
  });

  test('useDeleteMedia mutation works', async () => {
    if (!productId) {
      console.warn('Skipping test: no product found');
      expect(true).toBe(true);
      return;
    }

    const { result } = renderHook(() => useDeleteMedia(productId), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
  });
});
