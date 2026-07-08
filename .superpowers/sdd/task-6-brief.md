### Task 6: Wire sync into product create/update

**Files:**
- Modify: `services/products.ts`
- Modify: `__tests__/services/products.test.ts`

**Interfaces:**
- Consumes: `syncProductCategoryAssignments` from `@/services/product-categories` (Task 5).
- Produces: `createProduct` and `updateProduct` now call `syncProductCategoryAssignments` with the saved row after every successful write, swallowing (and logging) sync failures so a rule-sync bug never blocks a product save.

- [ ] **Step 1: Mock the new dependency in the existing test file so current assertions don't break**

At the top of `__tests__/services/products.test.ts`, after the existing `vi.mock('@/lib/supabase/client', ...)` block (around line 6), add:

```ts
const mockSyncProductCategoryAssignments = vi.fn().mockResolvedValue(undefined)
vi.mock('@/services/product-categories', () => ({
  syncProductCategoryAssignments: (...args: unknown[]) => mockSyncProductCategoryAssignments(...args),
}))
```

- [ ] **Step 2: Write the new failing tests**

In `__tests__/services/products.test.ts`, inside the existing `describe('createProduct', ...)` block, add:

```ts
  it('syncs product-category assignments after a successful create', async () => {
    const newProduct = { id: '2', name: 'New Product', price: 200, status: 'DRAFT', work_types: [], category_id: 'cat-1' }
    createMockChainForQuery({ data: newProduct, error: null })
    mockSyncProductCategoryAssignments.mockClear()
    await createProduct({ name: 'New Product', price: 200, category_id: 'cat-1' })
    expect(mockSyncProductCategoryAssignments).toHaveBeenCalledWith(newProduct)
  })
```

And inside the existing `describe('updateProduct', ...)` block, add:

```ts
  it('syncs product-category assignments after a successful update', async () => {
    const updated = { id: '1', name: 'Updated', price: 150, work_types: [], category_id: 'cat-2' }
    createMockChainForQuery({ data: updated, error: null })
    mockSyncProductCategoryAssignments.mockClear()
    await updateProduct('1', { name: 'Updated', price: 150 })
    expect(mockSyncProductCategoryAssignments).toHaveBeenCalledWith(updated)
  })
```

- [ ] **Step 3: Run the tests to verify the new ones fail and existing ones still pass**

Run: `npx vitest run __tests__/services/products.test.ts`
Expected: the two new tests FAIL (`mockSyncProductCategoryAssignments` never called); all pre-existing tests in this file still PASS, including the call-count assertion in `describe('createProduct — slug disambiguation', ...)`, because the sync call is fully mocked and never touches `mockFrom`.

- [ ] **Step 4: Wire the sync call into `createProduct` and `updateProduct`**

In `services/products.ts`, add the import at the top:

```ts
import { syncProductCategoryAssignments } from '@/services/product-categories'
```

Add a helper near the bottom of the file (after `isUniqueSlugViolation`, before `deleteProduct`):

```ts
async function syncCategoriesOrLog(product: Product) {
  try {
    await syncProductCategoryAssignments(product)
  } catch (err) {
    console.error('[products] Failed to sync category assignments:', err)
  }
}
```

In the no-slug branch of `createProduct` (the block starting `if (!productWithCode.slug) {`), change:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }
```

to:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    await syncCategoriesOrLog(data)
    return data as Product
  }
```

In the slug-disambiguation loop inside `createProduct`, change:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }

  throw new AppError('VALIDATION_ERROR', 'Unable to generate a unique product slug. Please try again.')
```

to:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    await syncCategoriesOrLog(data)
    return data as Product
  }

  throw new AppError('VALIDATION_ERROR', 'Unable to generate a unique product slug. Please try again.')
```

In `updateProduct`, change:

```ts
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'product',
    resourceId: id,
    newData: updates as Json,
  })

  return data as Product
```

to:

```ts
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'product',
    resourceId: id,
    newData: updates as Json,
  })
  await syncCategoriesOrLog(data)

  return data as Product
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run __tests__/services/products.test.ts`
Expected: PASS, including the previously-existing `expect(mockFrom).toHaveBeenCalledTimes(2)` assertion.

- [ ] **Step 6: Commit**

```bash
git add services/products.ts __tests__/services/products.test.ts
git commit -m "feat(category-rules): sync category assignments on every product save"
```

---

