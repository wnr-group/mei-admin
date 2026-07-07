import { describe, it, expect, vi } from 'vitest'
import { withRetry, withRetryableQuery } from '@/lib/retry'

describe('withRetry', () => {
  it('resolves on the first attempt when fn succeeds (happy path)', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries a retryable error and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce('recovered')
    const result = await withRetry(fn, { baseDelayMs: 1 })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rethrows a non-retryable error immediately without additional attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('validation failed'))
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('validation failed')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('exhausts maxAttempts and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fetch failed'))
    await expect(withRetry(fn, { baseDelayMs: 1, maxAttempts: 3 })).rejects.toThrow('fetch failed')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('retries on network error messages such as timeout', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValueOnce('ok')
    const result = await withRetry(fn, { baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry an AbortError even though its message looks network-related', async () => {
    const abortError = new Error('fetch failed: aborted')
    abortError.name = 'AbortError'
    const fn = vi.fn().mockRejectedValue(abortError)
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('fetch failed: aborted')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('withRetryableQuery', () => {
  it('returns a successful result unchanged', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [1, 2], error: null })
    const result = await withRetryableQuery(fn)
    expect(result).toEqual({ data: [1, 2], error: null })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns a non-retryable error result unchanged without throwing', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    const result = await withRetryableQuery(fn, { baseDelayMs: 1 })
    expect(result.error?.code).toBe('23505')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries a retryable error result and returns the eventual success', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'serialization failure' } })
      .mockResolvedValueOnce({ data: 'ok', error: null })
    const result = await withRetryableQuery(fn, { baseDelayMs: 1 })
    expect(result).toEqual({ data: 'ok', error: null })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('exhausts attempts on a persistent transient error and returns the last error result', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: '40001', message: 'serialization failure' } })
    const result = await withRetryableQuery(fn, { baseDelayMs: 1, maxAttempts: 3 })
    expect(result.error?.code).toBe('40001')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
