export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  isRetryable?: (err: unknown) => boolean
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 250

const RETRYABLE_POSTGRES_CODES = new Set(['40001', '40P01', '55P03'])

const RETRYABLE_MESSAGE_PATTERNS = [
  'fetch failed',
  'network',
  'timeout',
  'econnreset',
  'econnrefused',
  '429',
  'too many requests',
]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
 * Determines whether an error represents a transient failure that is safe
 * to retry (serialization/deadlock/lock timeouts from Postgres, or
 * network-level failures). AbortError is explicitly excluded so cancelled
 * requests are never retried, even if their message looks network-related.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') {
    return false
  }

  const code = (err as { code?: string } | null | undefined)?.code
  if (code && RETRYABLE_POSTGRES_CODES.has(code)) {
    return true
  }

  const message = getMessage(err).toLowerCase()
  return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))
}

/**
 * Runs `fn`, retrying on retryable errors with exponential backoff
 * (baseDelayMs * 2^(attempt-1)). Non-retryable errors are rethrown
 * immediately. After `maxAttempts` attempts the last error is rethrown.
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const shouldRetry = options?.isRetryable ?? isRetryableError

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= maxAttempts || !shouldRetry(err)) {
        throw err
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1))
    }
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error('withRetry: exhausted attempts without a result')
}

/**
 * Retry wrapper for Supabase-style `{ data, error }` responses, where a
 * failure is represented as a resolved result rather than a thrown error.
 * Non-retryable error results are returned unchanged (not thrown).
 * Retryable error results are retried with exponential backoff, and the
 * final result (success or error) is returned once attempts are exhausted.
 */
export async function withRetryableQuery<
  T extends { data: unknown; error: { code?: string; message: string } | null },
>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const shouldRetry = options?.isRetryable ?? isRetryableError

  let result: T = await fn()

  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    if (!result.error || !shouldRetry(result.error)) {
      return result
    }
    await sleep(baseDelayMs * 2 ** (attempt - 1))
    result = await fn()
  }

  return result
}
