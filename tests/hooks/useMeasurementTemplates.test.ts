import { renderHook } from '@testing-library/react';
import {
  useLibraryTemplates,
  useCreateLibraryTemplate,
  useProductOverride,
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
  const generateId = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  test('useLibraryTemplates hook created successfully', () => {
    const { result } = renderHook(() => useLibraryTemplates(), {
      wrapper: createWrapper(),
    });
    expect(result.current).toBeDefined();
  });

  test('useCreateLibraryTemplate mutation works', () => {
    const { result } = renderHook(() => useCreateLibraryTemplate(), {
      wrapper: createWrapper(),
    });
    expect(result.current).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending !== undefined).toBe(true);
  });

  test('useProductOverride hook created successfully', () => {
    const prodId = generateId();
    const { result } = renderHook(() => useProductOverride(prodId), {
      wrapper: createWrapper(),
    });
    expect(result.current).toBeDefined();
  });
});
