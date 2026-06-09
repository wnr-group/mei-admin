'use client'

import type { ErrorCode } from '@/lib/errors'

interface ErrorStateProps {
  message: string
  code?: ErrorCode
  onRetry?: () => void
}

function getAuthErrorMessage(code: ErrorCode): string | null {
  if (code === 'AUTH_EXPIRED') {
    return 'Your session has expired. Please sign in again.'
  }
  if (code === 'AUTH_FORBIDDEN') {
    return 'You do not have permission to perform this action.'
  }
  return null
}

export function ErrorState({ message, code, onRetry }: ErrorStateProps) {
  const displayMessage = code ? getAuthErrorMessage(code) || message : message

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-red-600">{displayMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-[#c9a465] underline underline-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  )
}
