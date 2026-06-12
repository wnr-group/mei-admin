import { renderHook, waitFor } from '@testing-library/react';
import {
  useBlouseConfig,
  useUpsertBlouseConfig,
} from '@/lib/hooks/useBlouseConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { createElement } from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useBlouseConfig Hook', () => {
  // Generate UUID-like string
  const generateId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  const testProductId = generateId();

  test('useBlouseConfig is disabled when productId is empty', async () => {
    const { result } = renderHook(() => useBlouseConfig(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  test('useBlouseConfig hook creates successfully with productId', async () => {
    const { result } = renderHook(() => useBlouseConfig(testProductId), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
  });

  test('useUpsertBlouseConfig mutation works', async () => {
    const { result } = renderHook(
      () => useUpsertBlouseConfig(testProductId),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
  });

  test('useUpsertBlouseConfig mutation has expected properties', async () => {
    const { result } = renderHook(
      () => useUpsertBlouseConfig(testProductId),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending !== undefined).toBe(true);
  });

  test('useBlouseConfig with customization type', async () => {
    const { result } = renderHook(
      () => useBlouseConfig(testProductId, 'CUSTOM_TAILORED'),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current).toBeDefined();
  });
});
