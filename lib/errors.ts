export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'NOT_FOUND'
  | 'DB_ERROR'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err

  if (err instanceof Error) {
    const msg = err.message.toLowerCase()

    // Auth errors
    if (msg.includes('jwt') || msg.includes('session') || msg.includes('not authenticated')) {
      return new AppError('AUTH_EXPIRED', err.message)
    }

    // Permission/RLS errors
    if (msg.includes('row-level') || msg.includes('permission') || msg.includes('policy')) {
      return new AppError('AUTH_FORBIDDEN', err.message)
    }

    // Storage errors (check before "not found" since "bucket not found" matches both)
    if (msg.includes('storage') || msg.includes('upload') || msg.includes('bucket')) {
      return new AppError('STORAGE_ERROR', err.message)
    }

    // Not found errors
    if (msg.includes('not found') || msg.includes('no rows')) {
      return new AppError('NOT_FOUND', err.message)
    }

    // Default to DB_ERROR for other errors
    return new AppError('DB_ERROR', err.message)
  }

  return new AppError('UNKNOWN_ERROR', 'An unexpected error occurred', err)
}

export function getErrorMessage(err: unknown): string {
  return toAppError(err).message
}
