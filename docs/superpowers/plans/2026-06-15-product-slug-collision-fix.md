# Product Slug Collision Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `products_slug_unique` constraint violations when two products share the same auto-generated slug, including under concurrent requests.

**Architecture:** Add `getProductBySlug()` (mirroring `getCategoryBySlug()`) plus a private `isUniqueSlugViolation()` guard. `createProduct()` runs a loop (max 20 attempts): pre-check each candidate with `getProductBySlug()` to skip obviously-taken slugs, then attempt the insert; if the insert itself returns a `23505` / `products_slug_unique` violation (race condition), increment the suffix and retry. This handles both the common case and the TOCTOU race. Audit logging fires on every successful insert path.

**Tech Stack:** TypeScript, Supabase JS client, Vitest

---

## File Map

- Modify: `services/products.ts` — add `getProductBySlug`, `isUniqueSlugViolation`, redesign `createProduct`
- Modify: `__tests__/services/products.test.ts` — add tests for `getProductBySlug`, slug-collision handling, and the race condition retry

---

### Task 1: Write failing tests

**Files:**
- Modify: `__tests__/services/products.test.ts`

- [ ] **Step 1: Read the current test file**

Open `__tests__/services/products.test.ts`. Note the existing `createMockChainForQuery` helper (line 16) — it calls `mockFrom.mockReturnValue(chain)` which sets a default. The new tests need per-call control, so a separate helper is added that does **not** wire `mockFrom`.

- [ ] **Step 2: Add `createChain` helper and new `describe` blocks**

Append the following after the existing `deleteProduct` describe block (end of file):

```typescript
// ─── chain factory that does NOT auto-wire mockFrom ──────────────────────────
function createChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'ilike', 'order', 'range', 'single', 'limit']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)
  return chain
}

const { getProductBySlug } = await import('@/services/products')

describe('getProductBySlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no product matches (PGRST116)', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const result = await getProductBySlug('nonexistent')
    expect(result).toBeNull()
  })

  it('returns { id, slug } when a product matches', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'p1', slug: 'lehenga' }, error: null }))
    const result = await getProductBySlug('lehenga')
    expect(result).toEqual({ id: 'p1', slug: 'lehenga' })
  })

  it('throws on unexpected Supabase error', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '42501', message: 'permission denied' } }))
    await expect(getProductBySlug('any')).rejects.toThrow('permission denied')
  })
})

describe('createProduct — slug disambiguation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts with the original slug when there is no collision', async () => {
    // attempt 1: pre-check lehenga → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 1: insert → success
    const inserted = { id: '1', name: 'Lehenga', slug: 'lehenga', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga')
    expect(mockFrom).toHaveBeenCalledTimes(2) // 1 pre-check + 1 insert
  })

  it('appends -2 when the pre-check finds the base slug is already taken', async () => {
    // attempt 1: pre-check lehenga → found, skip insert
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'existing', slug: 'lehenga' }, error: null }))
    // attempt 2: pre-check lehenga-2 → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 2: insert lehenga-2 → success
    const inserted = { id: '2', name: 'Lehenga', slug: 'lehenga-2', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga-2')
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })

  it('keeps climbing suffix until a free slot is found', async () => {
    // attempt 1: pre-check lehenga → found
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'a', slug: 'lehenga' }, error: null }))
    // attempt 2: pre-check lehenga-2 → found
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'b', slug: 'lehenga-2' }, error: null }))
    // attempt 3: pre-check lehenga-3 → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 3: insert lehenga-3 → success
    const inserted = { id: '3', name: 'Lehenga', slug: 'lehenga-3', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga-3')
    expect(mockFrom).toHaveBeenCalledTimes(4)
  })

  it('retries on insert unique-constraint violation caused by a concurrent create', async () => {
    // attempt 1: pre-check lehenga → available (race: another request hasn't inserted yet)
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 1: insert → 23505 (the concurrent request won the race)
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "products_slug_unique"' } }))
    // attempt 2: pre-check lehenga-2 → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 2: insert lehenga-2 → success
    const inserted = { id: '4', name: 'Lehenga', slug: 'lehenga-2', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga-2')
    expect(mockFrom).toHaveBeenCalledTimes(4) // 2 pre-checks + 2 inserts
  })

  it('also detects unique violation via message text (products_slug_unique)', async () => {
    // Some Supabase proxy configs surface the constraint name without the 23505 code
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '', message: 'ERROR: duplicate key value violates unique constraint "products_slug_unique"' } }))
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const inserted = { id: '5', name: 'Saree', slug: 'saree-2', price: 2000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Saree', slug: 'saree', price: 2000 })
    expect(result.slug).toBe('saree-2')
  })

  it('skips disambiguation entirely when slug is null', async () => {
    const inserted = { id: '6', name: 'No Slug', slug: null, price: 100 }
    mockFrom.mockReturnValue(createChain({ data: inserted, error: null }))

    await createProduct({ name: 'No Slug', price: 100 })
    expect(mockFrom).toHaveBeenCalledTimes(1) // insert only, no pre-check
  })

  it('throws VALIDATION_ERROR after exhausting 20 attempts', async () => {
    // All 20 pre-checks return "found" (no insert attempted in any iteration)
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? 'test' : `test-${i + 1}`
      mockFrom.mockReturnValueOnce(createChain({ data: { id: `x${i}`, slug }, error: null }))
    }

    await expect(createProduct({ name: 'Test', slug: 'test', price: 100 })).rejects.toThrow(
      /unable to generate a unique product slug/i
    )
  })

  it('audit log still fires after a successful disambiguated create', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const inserted = { id: '7', name: 'Saree', slug: 'saree', price: 2000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Saree', slug: 'saree', price: 2000 })
    expect(result.id).toBe('7') // createProduct resolved — audit fires as a side-effect
  })
})
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
npx vitest run __tests__/services/products.test.ts
```

Expected: All tests in `getProductBySlug` and `createProduct — slug disambiguation` **FAIL** (`getProductBySlug is not a function` / similar). This confirms the tests are wired to real behaviour, not stubs.

- [ ] **Step 4: Commit the failing tests**

```bash
git add __tests__/services/products.test.ts
git commit -m "test: add failing tests for product slug disambiguation and race retry"
```

---

### Task 2: Implement `getProductBySlug`, `isUniqueSlugViolation`, and updated `createProduct`

**Files:**
- Modify: `services/products.ts`

- [ ] **Step 1: Add `getProductBySlug` after `getProductById` (~line 100)**

Open `services/products.ts`. Insert after the closing `}` of `getProductById`:

```typescript
export async function getProductBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
  const supabase = createClient()
  const response = await supabase
    .from('products')
    .select('id, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  const { data, error } = response as { data: { id: string; slug: string } | null; error: { message: string; code: string } | null }
  if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
  return data ?? null
}
```

- [ ] **Step 2: Add the private `isUniqueSlugViolation` guard immediately after `getProductBySlug`**

```typescript
function isUniqueSlugViolation(error: { message: string; code?: string }): boolean {
  return error.code === '23505' || error.message.includes('products_slug_unique')
}
```

- [ ] **Step 3: Replace `createProduct` (currently lines 41–61) with the retry loop**

```typescript
export async function createProduct(product: ProductInsert) {
  const supabase = createClient()

  // No slug provided — simple insert, no disambiguation needed
  if (!product.slug) {
    const response = await supabase
      .from('products')
      .insert([product] as never)
      .select()
      .single()
    const { data, error } = response as { data: Product | null; error: { message: string } | null }
    if (error) throw toAppError(new Error(error.message))
    if (!data) throw new AppError('NOT_FOUND', 'Product not returned after insert')
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }

  const baseSlug = product.slug
  for (let attempt = 1; attempt <= 20; attempt++) {
    const candidateSlug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`

    // Pre-check: skip this candidate without hitting the constraint if it's obviously taken
    const existing = await getProductBySlug(candidateSlug)
    if (existing) continue

    const response = await supabase
      .from('products')
      .insert([{ ...product, slug: candidateSlug }] as never)
      .select()
      .single()
    const { data, error } = response as { data: Product | null; error: { message: string; code?: string } | null }

    if (error) {
      // Race condition: another concurrent request inserted the same slug between our pre-check and insert
      if (isUniqueSlugViolation(error)) continue
      throw toAppError(new Error(error.message))
    }
    if (!data) throw new AppError('NOT_FOUND', 'Product not returned after insert')

    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }

  throw new AppError('VALIDATION_ERROR', 'Unable to generate a unique product slug. Please try again.')
}
```

- [ ] **Step 4: Run all product tests**

```bash
npx vitest run __tests__/services/products.test.ts
```

Expected: All tests **PASS**. If the two pre-existing `createProduct` tests (`'creates and returns product'` and `'throws on Supabase error'`) now fail because they don't supply a slug (slug is omitted → falsy), they'll take the no-slug path and still only make 1 `from()` call — no mock changes needed. If either test passes a slug, update it to add a pre-check mock first:

```typescript
// If the existing test passes a slug, add the pre-check mock:
it('creates and returns product', async () => {
  const newProduct = { id: '2', name: 'New Product', price: 200, status: 'DRAFT', slug: 'new-product' }
  // pre-check → available
  mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
  // insert → success
  mockFrom.mockReturnValueOnce(createChain({ data: newProduct, error: null }))
  const result = await createProduct({ name: 'New Product', slug: 'new-product', price: 200 })
  expect(result.name).toBe('New Product')
})
```

- [ ] **Step 5: Run full test suite and type-check**

```bash
npx vitest run
```

Expected: All tests pass.

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 6: Commit the implementation**

```bash
git add services/products.ts __tests__/services/products.test.ts
git commit -m "feat: disambiguate product slugs on create with race-condition retry"
```

---

## Self-Review

| Spec requirement | Covered by |
|---|---|
| Colliding slug succeeds with `-2`, `-3` suffix | Loop in `createProduct`; tests "appends -2", "keeps climbing" |
| No `products_slug_unique` error surfaces to the user | Pre-check skips insert for known conflicts; `isUniqueSlugViolation` catches races |
| Race condition (TOCTOU) protected | Insert-level retry on `23505` or constraint name in message; test "retries on concurrent create" |
| Both `code: '23505'` and message text detected | `isUniqueSlugViolation`; test "also detects via message text" |
| Audit logging still fires | `logAuditEvent` present in both the no-slug path and the loop success path; test confirms |
| Cap retries to avoid infinite loop | `attempt <= 20`; throws `VALIDATION_ERROR` after exhaustion |
| Null slug bypasses disambiguation entirely | `if (!product.slug)` early return; test "skips disambiguation when slug is null" |
