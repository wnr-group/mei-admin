import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
  createUntypedClient: () => ({ from: mockFrom }),
}))

const mockGenerateProductCode = vi.fn((_name: string) => 'MEI-TEST-CODE')
vi.mock('@/lib/product-code', () => ({
  generateProductCode: (name: string) => mockGenerateProductCode(name),
}))

const mockCaptureError = vi.fn()
vi.mock('@/lib/monitoring', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}))

const mockUploadProductImage = vi.fn((_file: File, _productId: string) => Promise.resolve('https://example.com/uploaded-image.jpg'))
vi.mock('@/services/storage', () => ({
  uploadProductImage: (file: File, productId: string) => mockUploadProductImage(file, productId),
}))

const mockValidateImageFile = vi.fn((_file: File) => null)
vi.mock('@/lib/validators/image', () => ({
  validateImageFile: (file: File) => mockValidateImageFile(file),
}))

const {
  bulkImportProducts,
  resolveCategoryId,
  resolveUniqueSlug,
  resolveUniqueProductCode,
  findExistingProductNames,
} = await import('@/services/product-import')

import { PRODUCT_INSERT_CHUNK_SIZE } from '@/lib/product-import-constants'
import type { ProductGroup } from '@/lib/csv-import/types'

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

function createChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'single', 'abortSignal']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected) => promise.catch(onRejected)
  chain.finally = (onFinally) => promise.finally(onFinally)
  return chain
}

const NOT_FOUND = { data: null, error: { code: 'PGRST116', message: 'No rows found' } }

function makeGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    name: 'Lehenga A',
    rawName: 'Lehenga A',
    originalRowIndex: 2,
    categoryName: 'Bridal Lehengas',
    price: 45000,
    rawPrice: '45000',
    status: 'PUBLISHED',
    rawStatus: 'PUBLISHED',
    workTypes: [],
    rawWorkTypes: '',
    shortDescription: null,
    description: null,
    colors: [],
    primaryImages: [{ url: 'https://example.com/a.jpg', isFromRow: 2 }],
    errors: [],
    groupRowIndices: [2],
    ...overrides,
  }
}

const categories = [{ id: 'cat-1', name: 'Bridal Lehengas' }]

describe('resolveCategoryId', () => {
  it('matches a category name case-insensitively', () => {
    expect(resolveCategoryId('bridal lehengas', categories)).toBe('cat-1')
  })

  it('returns null when no category matches', () => {
    expect(resolveCategoryId('Sarees', categories)).toBeNull()
  })
})

describe('resolveUniqueSlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the base slug when it is available', async () => {
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const slug = await resolveUniqueSlug('Lehenga A', new Set())
    expect(slug).toBe('lehenga-a')
  })

  it('skips slugs already reserved in-memory for this batch', async () => {
    const reserved = new Set(['lehenga-a'])
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const slug = await resolveUniqueSlug('Lehenga A', reserved)
    expect(slug).toBe('lehenga-a-2')
  })

  it('appends a numeric suffix when the base slug exists in the DB', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: { id: 'existing', slug: 'lehenga-a' }, error: null }))
      .mockReturnValueOnce(createChain(NOT_FOUND))
    const slug = await resolveUniqueSlug('Lehenga A', new Set())
    expect(slug).toBe('lehenga-a-2')
  })

  it('returns null after 20 failed attempts', async () => {
    for (let i = 0; i < 20; i++) {
      mockFrom.mockReturnValueOnce(createChain({ data: { id: `x${i}`, slug: 'taken' }, error: null }))
    }
    const slug = await resolveUniqueSlug('Lehenga A', new Set())
    expect(slug).toBeNull()
  })
})

describe('resolveUniqueProductCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateProductCode.mockReturnValue('MEI-TEST-CODE')
  })

  it('returns the generated code when it is available', async () => {
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const code = await resolveUniqueProductCode('Lehenga A', new Set())
    expect(code).toBe('MEI-TEST-CODE')
  })

  it('regenerates when the candidate collides in the DB', async () => {
    mockGenerateProductCode
      .mockReturnValueOnce('MEI-TEST-CODE')
      .mockReturnValueOnce('MEI-TEST-CODE2')
    mockFrom
      .mockReturnValueOnce(createChain({ data: { id: 'existing', product_code: 'MEI-TEST-CODE' }, error: null }))
      .mockReturnValueOnce(createChain(NOT_FOUND))
    const code = await resolveUniqueProductCode('Lehenga A', new Set())
    expect(code).toBe('MEI-TEST-CODE2')
  })

  it('regenerates when the candidate is already reserved in-memory', async () => {
    const reserved = new Set(['MEI-TEST-CODE'])
    mockGenerateProductCode
      .mockReturnValueOnce('MEI-TEST-CODE')
      .mockReturnValueOnce('MEI-TEST-CODE2')
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const code = await resolveUniqueProductCode('Lehenga A', reserved)
    expect(code).toBe('MEI-TEST-CODE2')
  })
})

describe('findExistingProductNames', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty array when given no names, without querying the DB', async () => {
    const result = await findExistingProductNames([])
    expect(result).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns names that already exist in the DB, case-insensitively', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: [{ name: 'Bridal Lehenga A1' }], error: null }))
    const result = await findExistingProductNames(['bridal lehenga a1', 'New Gown'])
    expect(result).toEqual(['bridal lehenga a1'])
  })

  it('returns an empty array when none of the names exist', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: [{ name: 'Something Else' }], error: null }))
    const result = await findExistingProductNames(['New Gown'])
    expect(result).toEqual([])
  })

  it('throws on a Supabase error', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { message: 'DB error' } }))
    await expect(findExistingProductNames(['X'])).rejects.toThrow('DB error')
  })
})

describe('bulkImportProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateProductCode.mockReturnValue('MEI-TEST-CODE')

    // Mock global fetch to return a valid image response
    // This is needed for downloadValidateAndUploadImage() which calls fetch()
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => {
            if (name.toLowerCase() === 'content-type') {
              return 'image/jpeg'
            }
            return null
          },
        },
        arrayBuffer: () => {
          // Return a minimal valid JPEG buffer (1x1 pixel)
          const jpegBuffer = Buffer.from([
            0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
            0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
            0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
            0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
            0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, 0xff, 0xc4, 0x00, 0x14,
            0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
          ])
          return Promise.resolve(jpegBuffer.buffer as ArrayBuffer)
        },
      })
    )
    vi.stubGlobal('fetch', mockFetch)
  })

  it('imports a single product with a primary image and reports expanded summary fields', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug check
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code check
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // primary image (multi-row insert)
      .mockReturnValueOnce(createChain({ error: null })) // product image_url update

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.failureCount).toBe(0)
    expect(summary.productsCreated).toBe(1)
    expect(summary.colorsCreated).toBe(0)
    expect(summary.mediaCreated).toBe(1)
    expect(summary.rowsProcessed).toBe(1)
    expect(summary.durationMs).toBeGreaterThanOrEqual(0)
    expect(summary.productsPerSecond).toBeGreaterThanOrEqual(0)
    expect(summary.rowsPerSecond).toBeGreaterThanOrEqual(0)
    expect(summary.averageChunkDurationMs).toBeGreaterThanOrEqual(0)
    expect(summary.results).toEqual([{ name: 'Lehenga A', success: true, productId: 'prod-1' }])
  })

  it('falls back to per-row inserts if the batch insert returns a mismatched row count (defensive stable-mapping guard)', async () => {
    // A batch insert that returns fewer/more rows than requested would break
    // positional pairing between the response and the source groups — this
    // is treated exactly like a failed batch and falls back to the per-row
    // path instead of risking a mis-paired product/group.
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: [], error: null })) // batch insert returns 0 rows for 1 requested
      .mockReturnValueOnce(createChain({ data: { id: 'prod-1', name: 'Lehenga A' }, error: null })) // fallback single insert succeeds
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // media
      .mockReturnValueOnce(createChain({ error: null })) // product image_url update

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.results[0].productId).toBe('prod-1')
  })

  it('batch-inserts colors and media (one call per table) and dedupes a repeated image URL', async () => {
    const group = makeGroup({
      primaryImages: [],
      colors: [{ label: 'Red', imageUrls: ['red1.jpg', 'red1.jpg', 'red2.jpg'] }],
    })

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert
      .mockReturnValueOnce(createChain({ data: [{ id: 'color-1', label: 'Red' }], error: null })) // colors (one call)
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }, { id: 'media-2' }], error: null })) // media (one call, deduped to 2 rows)

    const summary = await bulkImportProducts([group], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.colorsCreated).toBe(1)
    expect(summary.mediaCreated).toBe(2) // 3 URLs in the source, 1 exact duplicate deduped away
  })

  it('records a failure when the category cannot be resolved, without touching the DB', async () => {
    const group = makeGroup({ categoryName: 'Nonexistent' })
    const summary = await bulkImportProducts([group], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.failureCount).toBe(1)
    expect(summary.results[0].errorCode).toBe('CATEGORY_NOT_FOUND')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('records a failure when a unique slug cannot be found after 20 attempts', async () => {
    for (let i = 0; i < 20; i++) {
      mockFrom.mockReturnValueOnce(createChain({ data: { id: `x${i}`, slug: 'taken' }, error: null }))
    }

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.results[0].errorCode).toBe('SLUG_COLLISION')
  })

  it('falls back to per-row insert and retries with a fresh slug/code on a concurrent unique-constraint collision', async () => {
    // Simulates two admins racing for the same slug: our pre-check says
    // 'lehenga-a' is free, but by the time we insert, a concurrent import
    // has already taken it — the insert comes back as a 23505, and we must
    // re-resolve and retry rather than give up.
    mockGenerateProductCode
      .mockReturnValueOnce('MEI-TEST-CODE')   // initial resolveUniqueProductCode pre-check
      .mockReturnValueOnce('MEI-TEST-CODE-2') // retry's resolveUniqueProductCode call

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug pre-check: 'lehenga-a' free
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code pre-check: 'MEI-TEST-CODE' free
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'batch insert failed' } })) // whole-chunk batch insert fails
      .mockReturnValueOnce(createChain({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "products_slug_unique"' } })) // fallback single insert: race lost
      .mockReturnValueOnce(createChain(NOT_FOUND)) // retry: 'lehenga-a-2' free
      .mockReturnValueOnce(createChain(NOT_FOUND)) // retry: 'MEI-TEST-CODE-2' free
      .mockReturnValueOnce(createChain({ data: { id: 'prod-1', name: 'Lehenga A' }, error: null })) // fallback single insert retried: success
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // media
      .mockReturnValueOnce(createChain({ error: null })) // product image_url update

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.results[0].productId).toBe('prod-1')
  })

  it('retries the batch insert once on a transient network error, then succeeds', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'fetch failed: network timeout' } })) // transient failure
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // retried batch insert succeeds
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // media
      .mockReturnValueOnce(createChain({ error: null })) // product image_url update

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.results[0].productId).toBe('prod-1')
  })

  it('classifies an RLS-denied insert failure and does not retry it', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'new row violates row-level security policy' } })) // batch insert fails
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'new row violates row-level security policy' } })) // fallback insert fails the same way

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.results[0].errorCode).toBe('RLS_DENIED')
  })

  it('compensates by soft-deleting the product when color creation fails', async () => {
    const group = makeGroup({ primaryImages: [], colors: [{ label: 'Red', imageUrls: ['red1.jpg'] }] })

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert succeeds
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'insert failed' } })) // color insert fails
      .mockReturnValueOnce(createChain({ error: null })) // compensating soft-delete (deleteProduct)

    const summary = await bulkImportProducts([group], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.failureCount).toBe(1)
    expect(summary.results[0]).toMatchObject({ success: false, productId: 'prod-1', errorCode: 'COLOR_INSERT_FAILED' })
  })

  it('rejects an import that exceeds the maximum products per import, without touching the DB', async () => {
    const groups = Array.from({ length: 1001 }, (_, i) => makeGroup({ name: `Product ${i}` }))
    await expect(bulkImportProducts(groups, categories)).rejects.toThrow(/1000-product limit/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('reports progress through each stage in order', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND))
      .mockReturnValueOnce(createChain(NOT_FOUND))
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null }))

    const stages: string[] = []
    await bulkImportProducts([makeGroup()], categories, { onProgress: (stage) => stages.push(stage) })

    expect(stages).toEqual([
      'RESOLVING_CATEGORIES',
      'GENERATING_IDENTIFIERS',
      'CREATING_PRODUCTS',
      'CREATING_COLORS_AND_MEDIA',
      'LOGGING_AUDIT',
      'COMPLETED',
    ])
  })

  it('splits a large import into PRODUCT_INSERT_CHUNK_SIZE-sized batch inserts', async () => {
    const groupCount = PRODUCT_INSERT_CHUNK_SIZE + 50 // 250 with the default 200 chunk size -> 2 chunks
    const groups = Array.from({ length: groupCount }, (_, i) => makeGroup({ name: `Product ${i}` }))

    // Each product needs a distinct generated code (mirroring real
    // generateProductCode's per-call randomness) so the shared in-memory
    // reservedCodes Set never causes an artificial collision across 250
    // distinct products — this test is exercising chunking, not collision
    // handling (that's covered by the resolveUniqueProductCode suite).
    mockGenerateProductCode.mockImplementation((name: string) => `MEI-CODE-${name.replace(/\s+/g, '')}`)

    for (let i = 0; i < groupCount; i++) {
      mockFrom
        .mockReturnValueOnce(createChain(NOT_FOUND)) // slug check
        .mockReturnValueOnce(createChain(NOT_FOUND)) // code check
    }

    const chunks = [groups.slice(0, PRODUCT_INSERT_CHUNK_SIZE), groups.slice(PRODUCT_INSERT_CHUNK_SIZE)]
    for (const chunkGroups of chunks) {
      const chunkData = chunkGroups.map((g) => ({ id: `prod-${g.name}`, name: g.name }))
      mockFrom.mockReturnValueOnce(createChain({ data: chunkData, error: null }))
    }

    for (let i = 0; i < groupCount; i++) {
      mockFrom.mockReturnValueOnce(createChain({ data: [{ id: `media-${i}` }], error: null }))
    }

    for (let i = 0; i < groupCount; i++) {
      mockFrom.mockReturnValueOnce(createChain({ error: null })) // product image_url update for each product
    }

    const summary = await bulkImportProducts(groups, categories)

    expect(summary.productsCreated).toBe(groupCount)
    expect(summary.failureCount).toBe(0)
  }, 15000)

  it('reports multiple products independently in one summary', async () => {
    const groupA = makeGroup({ name: 'Lehenga A' })
    const groupB = makeGroup({ name: 'Lehenga B', categoryName: 'Nonexistent' })

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug for A
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code for A
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert (only A)
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // A's primary image
      .mockReturnValueOnce(createChain({ error: null })) // product image_url update for A

    const summary = await bulkImportProducts([groupA, groupB], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.failureCount).toBe(1)
    expect(summary.results.find((r) => r.name === 'Lehenga B')?.errorCode).toBe('CATEGORY_NOT_FOUND')
  })
})
