import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getProducts, createProduct } = await import('@/services/products')
const { getCategories, createCategory } = await import('@/services/categories')
const { getOrders } = await import('@/services/orders')
const { getBanners } = await import('@/services/banners')
const { getSettings } = await import('@/services/settings')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

function createMockChainForQuery(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'delete', 'is', 'eq', 'ilike', 'order', 'range', 'single', 'limit']

  methods.forEach(m => {
    chain[m] = vi.fn(() => chain)
  })

  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)

  mockFrom.mockReturnValue(chain)
  return chain
}

describe('Service Error Handling', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('Products service', () => {
    it('throws AppError with DB_ERROR code on getProducts failure', async () => {
      createMockChainForQuery({ data: null, count: null, error: { message: 'Connection timeout' } })
      try {
        await getProducts()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('DB_ERROR')
        expect((err as AppError).message).toBe('Connection timeout')
      }
    })

    it('throws AppError with NOT_FOUND code on createProduct not found error', async () => {
      createMockChainForQuery({ data: null, error: { message: 'Product not found' } })
      try {
        await createProduct({ name: 'Test', price: 100 })
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('NOT_FOUND')
      }
    })

    it('throws AppError with AUTH_FORBIDDEN on RLS policy error', async () => {
      createMockChainForQuery({ data: null, count: null, error: { message: 'new row violates row-level security policy' } })
      try {
        await getProducts()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('AUTH_FORBIDDEN')
      }
    })
  })

  describe('Categories service', () => {
    it('throws AppError with STORAGE_ERROR on bucket error', async () => {
      createMockChainForQuery({ data: null, count: null, error: { message: 'Bucket does not exist' } })
      try {
        await getCategories()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('STORAGE_ERROR')
      }
    })

    it('throws AppError with DB_ERROR on generic error', async () => {
      createMockChainForQuery({ data: null, error: { message: 'Unknown error' } })
      try {
        await createCategory({ name: 'Test', slug: 'test' })
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('DB_ERROR')
      }
    })
  })

  describe('Orders service', () => {
    it('throws AppError on getOrders failure', async () => {
      createMockChainForQuery({ data: null, count: null, error: { message: 'Table does not exist' } })
      try {
        await getOrders()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).message).toBe('Table does not exist')
      }
    })
  })

  describe('Banners service', () => {
    it('throws AppError on getBanners failure', async () => {
      createMockChainForQuery({ data: null, count: null, error: { message: 'Database connection failed' } })
      try {
        await getBanners()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('DB_ERROR')
      }
    })
  })

  describe('Settings service', () => {
    it('throws AppError on getSettings failure', async () => {
      createMockChainForQuery({ data: null, error: { message: 'Permission denied' } })
      try {
        await getSettings()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('AUTH_FORBIDDEN')
      }
    })
  })
})
