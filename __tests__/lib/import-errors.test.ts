import { describe, it, expect } from 'vitest'
import { ImportStageError, classifyError } from '@/lib/import-errors'

describe('ImportStageError', () => {
  it('carries a code and message and is an Error instance', () => {
    const error = new ImportStageError('CATEGORY_NOT_FOUND', 'Category "Sarees" was not found')
    expect(error.code).toBe('CATEGORY_NOT_FOUND')
    expect(error.message).toBe('Category "Sarees" was not found')
    expect(error.name).toBe('ImportStageError')
    expect(error instanceof Error).toBe(true)
  })
})

describe('classifyError', () => {
  it('classifies a unique violation identified by postgres code', () => {
    const err = { code: '23505', message: 'duplicate key value violates unique constraint' }
    expect(classifyError(err)).toBe('UNIQUE_CONSTRAINT')
  })

  it('classifies a unique violation identified by message', () => {
    const err = new Error('duplicate key value violates unique constraint "products_slug_key"')
    expect(classifyError(err)).toBe('UNIQUE_CONSTRAINT')
  })

  it('classifies RLS/permission denials', () => {
    const err = new Error('new row violates row-level security policy for table "products"')
    expect(classifyError(err)).toBe('RLS_DENIED')
  })

  it('classifies network/timeout errors', () => {
    const err = new Error('fetch failed: request timeout')
    expect(classifyError(err)).toBe('NETWORK_TIMEOUT')
  })

  it('classifies unrecognized errors as DATABASE_ERROR', () => {
    const err = new Error('some unexpected postgres failure')
    expect(classifyError(err)).toBe('DATABASE_ERROR')
  })

  it('classifies null/undefined as UNKNOWN_ERROR', () => {
    expect(classifyError(null)).toBe('UNKNOWN_ERROR')
    expect(classifyError(undefined)).toBe('UNKNOWN_ERROR')
  })

  it('returns the code directly for an ImportStageError', () => {
    const err = new ImportStageError('SLUG_COLLISION', 'Slug collision after 20 attempts')
    expect(classifyError(err)).toBe('SLUG_COLLISION')
  })
})
