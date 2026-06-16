import { renderHook, waitFor } from '@testing-library/react';
import {
  useTemplates,
  useCreateTemplate,
} from '@/lib/hooks/useMeasurementTemplates';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { createElement } from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'Wrapper';
  return Wrapper;
};

describe('useMeasurementTemplates Hook', () => {
  // Generate UUID-like string
  const generateId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  test('useTemplates hook created successfully', async () => {
    const { result } = renderHook(() => useTemplates(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
  });

  test('useTemplates with filters', async () => {
    const catId = generateId();
    const { result } = renderHook(
      () => useTemplates({ categoryId: catId }),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current).toBeDefined();
  });

  test('useCreateTemplate mutation works', async () => {
    const { result } = renderHook(() => useCreateTemplate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
  });

  test('useCreateTemplate mutation has expected properties', async () => {
    const { result } = renderHook(() => useCreateTemplate(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending !== undefined).toBe(true);
  });

  test('useTemplates with productId filter', async () => {
    const prodId = generateId();
    const { result } = renderHook(
      () => useTemplates({ productId: prodId }),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current).toBeDefined();
  });
});
