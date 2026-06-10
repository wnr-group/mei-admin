'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { captureError } from '@/lib/monitoring'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: 2 },
      },
      queryCache: new QueryCache({
        onError: (error) => captureError(error, { context: 'react-query' }),
      }),
      mutationCache: new MutationCache({
        onError: (error) => captureError(error, { context: 'react-query-mutation' }),
      }),
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
