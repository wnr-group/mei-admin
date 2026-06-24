import { renderHook, waitFor } from '@testing-library/react';
import { useSizeSystems, useSizeSystemEntries } from '@/lib/hooks/useSizeSystems';
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

describe('useSizeSystems Hook', () => {
  test('useSizeSystems fetches and returns systems', async () => {
    const { result } = renderHook(() => useSizeSystems(), {
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

  test('useSizeSystemEntries fetches entries for system', async () => {
    const { result: systemsResult } = renderHook(() => useSizeSystems(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(systemsResult.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    const systemId = systemsResult.current.data?.[0]?.id;
    const { result: entriesResult } = renderHook(
      () => useSizeSystemEntries(systemId!),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(
      () => {
        expect(entriesResult.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(entriesResult.current.data).toBeDefined();
  });
});
