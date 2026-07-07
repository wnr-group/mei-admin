# Task 2 Brief: Extract `generateProductCode` and add `getProductByCode`

## Overview

Extract the inline `generateProductCode` logic from `services/products.ts` into a shared module, add a new `getProductByCode` lookup function, and update both the service and its tests.

## Exact Requirements (from Plan Section: Task 2)

### Files to create/modify:
- **Create:** `lib/product-code.ts`
- **Create:** `__tests__/lib/product-code.test.ts`
- **Modify:** `services/products.ts:1` (add import), `services/products.ts:44-48` (use shared helper), `services/products.ts` (add `getProductByCode` after line 143)
- **Modify:** `__tests__/services/products.test.ts` (add `getProductByCode` tests)

### Interfaces produced:
- `generateProductCode(name: string): string`
- `getProductByCode(productCode: string): Promise<{ id: string; product_code: string } | null>`

### Test cases for `generateProductCode`:

```ts
it('prefixes with MEI- and a 6-character uppercase name segment', () => {
  const code = generateProductCode('Lehenga A2')
  expect(code.startsWith('MEI-LEHENG-')).toBe(true)
})

it('strips non-alphanumeric characters from the name segment', () => {
  const code = generateProductCode("Women's Silk Saree!")
  expect(code).toMatch(/^MEI-WOMENS-[A-Z0-9]{4}$/)
})

it('truncates the name segment to 6 characters', () => {
  const code = generateProductCode('SuperLongProductName')
  expect(code.split('-')[1]).toHaveLength(6)
})

it('generates a 4-character uppercase alphanumeric random suffix', () => {
  const code = generateProductCode('Gown')
  const suffix = code.split('-')[2]
  expect(suffix).toMatch(/^[A-Z0-9]{4}$/)
})

it('produces different codes across calls for the same name', () => {
  const codes = new Set(Array.from({ length: 10 }, () => generateProductCode('Gown')))
  expect(codes.size).toBeGreaterThan(1)
})
```

### Implementation (exact code from plan):

```ts
export function generateProductCode(name: string): string {
  const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6)
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MEI-${sanitizedName}-${randomSuffix}`
}
```

### `getProductByCode` test cases:

```ts
it('returns null when no product matches (PGRST116)', async () => {
  mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
  const result = await getProductByCode('MEI-NOPE-0000')
  expect(result).toBeNull()
})

it('returns { id, product_code } when a product matches', async () => {
  mockFrom.mockReturnValueOnce(createChain({ data: { id: 'p1', product_code: 'MEI-LEHENG-AB12' }, error: null }))
  const result = await getProductByCode('MEI-LEHENG-AB12')
  expect(result).toEqual({ id: 'p1', product_code: 'MEI-LEHENG-AB12' })
})

it('throws on unexpected Supabase error', async () => {
  mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '42501', message: 'permission denied' } }))
  await expect(getProductByCode('any')).rejects.toThrow('permission denied')
})
```

### `getProductByCode` implementation (exact code from plan):

```ts
export async function getProductByCode(productCode: string): Promise<{ id: string; product_code: string } | null> {
  const supabase = createClient()
  const response = await supabase
    .from('products')
    .select('id, product_code')
    .eq('product_code', productCode)
    .is('deleted_at', null)
    .single()
  const { data, error } = response as { data: { id: string; product_code: string } | null; error: { message: string; code: string } | null }
  if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
  return data ?? null
}
```

### ProductForm changes (in `services/products.ts`):
- Add import at the top (after line 1):
  ```ts
  import { generateProductCode } from '@/lib/product-code'
  ```
- Replace lines 44-48 with:
  ```ts
  const productWithCode = {
    ...product,
    product_code: product.product_code || generateProductCode(product.name)
  }
  ```

## Verification steps:
1. Run new tests: `npx vitest run __tests__/lib/product-code.test.ts` → all 5 pass
2. Run service tests: `npx vitest run __tests__/services/products.test.ts` → all pass (including 3 new `getProductByCode` tests)
3. Type check: `npx tsc --noEmit` → no errors

## Report File
Report to: `.superpowers/sdd/bulk-task-2-report.md`
