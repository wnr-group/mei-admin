import * as Sentry from '@sentry/nextjs'
import type { AppError } from '@/lib/errors'

export function captureError(err: AppError | Error | unknown, context?: Record<string, string>) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error captured]', err, context)
    return
  }

  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v))
    }
    Sentry.captureException(err)
  })
}
