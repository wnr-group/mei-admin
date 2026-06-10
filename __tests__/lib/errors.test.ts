import { describe, it, expect } from 'vitest'
import { AppError, toAppError, getErrorMessage, type ErrorCode } from '@/lib/errors'

describe('AppError', () => {
  it('creates an AppError with code and message', () => {
    const error = new AppError('DB_ERROR', 'Database connection failed')
    expect(error.code).toBe('DB_ERROR')
    expect(error.message).toBe('Database connection failed')
    expect(error.name).toBe('AppError')
  })

  it('stores optional details', () => {
    const details = { originalError: 'some details' }
    const error = new AppError('UNKNOWN_ERROR', 'Something went wrong', details)
    expect(error.details).toEqual(details)
  })

  it('extends Error class', () => {
    const error = new AppError('DB_ERROR', 'test')
    expect(error instanceof Error).toBe(true)
  })
})

describe('toAppError', () => {
  it('returns AppError unchanged', () => {
    const original = new AppError('DB_ERROR', 'Database failed')
    const result = toAppError(original)
    expect(result).toBe(original)
  })

  it('converts Error to AppError with DB_ERROR when no keyword match', () => {
    const error = new Error('Some database issue')
    const result = toAppError(error)
    expect(result).toBeInstanceOf(AppError)
    expect(result.code).toBe('DB_ERROR')
    expect(result.message).toBe('Some database issue')
  })

  it('detects JWT errors and converts to AUTH_EXPIRED', () => {
    const error = new Error('JWT invalid signature')
    const result = toAppError(error)
    expect(result.code).toBe('AUTH_EXPIRED')
  })

  it('detects session errors and converts to AUTH_EXPIRED', () => {
    const error = new Error('Session has expired')
    const result = toAppError(error)
    expect(result.code).toBe('AUTH_EXPIRED')
  })

  it('detects authentication errors and converts to AUTH_EXPIRED', () => {
    const error = new Error('not authenticated')
    const result = toAppError(error)
    expect(result.code).toBe('AUTH_EXPIRED')
  })

  it('detects RLS policy errors and converts to AUTH_FORBIDDEN', () => {
    const error = new Error('new row violates row-level security policy')
    const result = toAppError(error)
    expect(result.code).toBe('AUTH_FORBIDDEN')
  })

  it('detects permission errors and converts to AUTH_FORBIDDEN', () => {
    const error = new Error('Permission denied')
    const result = toAppError(error)
    expect(result.code).toBe('AUTH_FORBIDDEN')
  })

  it('detects policy errors and converts to AUTH_FORBIDDEN', () => {
    const error = new Error('Update policy violation')
    const result = toAppError(error)
    expect(result.code).toBe('AUTH_FORBIDDEN')
  })

  it('detects not found errors', () => {
    const error = new Error('Product not found')
    const result = toAppError(error)
    expect(result.code).toBe('NOT_FOUND')
  })

  it('detects "no rows" errors', () => {
    const error = new Error('no rows returned')
    const result = toAppError(error)
    expect(result.code).toBe('NOT_FOUND')
  })

  it('detects storage errors', () => {
    const error = new Error('Storage bucket not found')
    const result = toAppError(error)
    expect(result.code).toBe('STORAGE_ERROR')
  })

  it('detects upload errors', () => {
    const error = new Error('Upload failed: 413 Payload Too Large')
    const result = toAppError(error)
    expect(result.code).toBe('STORAGE_ERROR')
  })

  it('detects bucket errors', () => {
    const error = new Error('Bucket does not exist')
    const result = toAppError(error)
    expect(result.code).toBe('STORAGE_ERROR')
  })

  it('converts non-Error objects to UNKNOWN_ERROR', () => {
    const result = toAppError('string error')
    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.message).toBe('An unexpected error occurred')
    expect(result.details).toBe('string error')
  })

  it('converts null to UNKNOWN_ERROR', () => {
    const result = toAppError(null)
    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.details).toBeNull()
  })

  it('converts undefined to UNKNOWN_ERROR', () => {
    const result = toAppError(undefined)
    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.details).toBeUndefined()
  })
})

describe('getErrorMessage', () => {
  it('extracts message from Error', () => {
    const error = new Error('Test error')
    const message = getErrorMessage(error)
    expect(message).toBe('Test error')
  })

  it('extracts message from AppError', () => {
    const error = new AppError('DB_ERROR', 'Database failed')
    const message = getErrorMessage(error)
    expect(message).toBe('Database failed')
  })

  it('extracts message from non-Error object', () => {
    const message = getErrorMessage({ some: 'object' })
    expect(message).toBe('An unexpected error occurred')
  })
})

describe('ErrorCode type', () => {
  it('allows all valid error codes', () => {
    const codes: ErrorCode[] = [
      'VALIDATION_ERROR',
      'AUTH_EXPIRED',
      'AUTH_FORBIDDEN',
      'NOT_FOUND',
      'DB_ERROR',
      'NETWORK_ERROR',
      'STORAGE_ERROR',
      'UNKNOWN_ERROR',
    ]
    expect(codes).toHaveLength(8)
  })
})
