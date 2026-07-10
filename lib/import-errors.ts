export type ImportErrorCode =
  | 'CATEGORY_NOT_FOUND'
  | 'SLUG_COLLISION'
  | 'PRODUCT_CODE_COLLISION'
  | 'PRODUCT_INSERT_FAILED'
  | 'COLOR_INSERT_FAILED'
  | 'MEDIA_INSERT_FAILED'
  | 'NETWORK_TIMEOUT'
  | 'DATABASE_ERROR'
  | 'UNIQUE_CONSTRAINT'
  | 'VALIDATION_FAILED'
  | 'RLS_DENIED'
  | 'UNKNOWN_ERROR'

export class ImportStageError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ImportStageError'
  }
}

function getMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message
    if (typeof msg === 'string') return msg
  }
  return ''
}

/**
 * Maps an unknown error (thrown Error, Postgres-style {code, message}
 * object, or ImportStageError) to a stable ImportErrorCode for reporting
 * and retry decisions during bulk import.
 */
export function classifyError(err: unknown): ImportErrorCode {
  if (err instanceof ImportStageError) return err.code

  if (err === null || err === undefined) return 'UNKNOWN_ERROR'

  const code = (err as { code?: string } | null | undefined)?.code

  if (code === '23505') return 'UNIQUE_CONSTRAINT'

  const message = getMessage(err).toLowerCase()

  if (message.includes('unique') || message.includes('duplicate key')) {
    return 'UNIQUE_CONSTRAINT'
  }

  if (
    message.includes('row-level') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('rls')
  ) {
    return 'RLS_DENIED'
  }

  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('econnrefused')
  ) {
    return 'NETWORK_TIMEOUT'
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return 'VALIDATION_FAILED'
  }

  if (!(err instanceof Error) && typeof err !== 'string' && !code && !message) {
    return 'UNKNOWN_ERROR'
  }

  return 'DATABASE_ERROR'
}
