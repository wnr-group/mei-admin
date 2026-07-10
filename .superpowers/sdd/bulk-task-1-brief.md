# Task 1 Brief: Extract `generateSlug` into a shared utility

## Overview

Extract the local `generateSlug` function from `components/products/ProductForm.tsx` into a new shared module `lib/slug.ts`, add comprehensive unit tests, and update the ProductForm to import and use the shared version.

## Exact Requirements (from Plan Section: Task 1)

### Files to create/modify:
- **Create:** `lib/slug.ts`
- **Create:** `__tests__/lib/slug.test.ts`
- **Modify:** `components/products/ProductForm.tsx:3-12` (add import), `components/products/ProductForm.tsx:121-129` (remove local definition)

### Interface produced:
- `generateSlug(value: string): string` — used by Task 4's `resolveUniqueSlug`.

### Test cases (from plan):

```ts
it('lowercases and hyphenates a simple name', () => {
  expect(generateSlug('Bridal Lehenga A2')).toBe('bridal-lehenga-a2')
})

it('strips punctuation characters', () => {
  expect(generateSlug("Women's Silk Saree!")).toBe('womens-silk-saree')
})

it('collapses repeated spaces, underscores, and hyphens into one hyphen', () => {
  expect(generateSlug('Red   -- Gold_ _Lehenga')).toBe('red-gold-lehenga')
})

it('trims leading and trailing hyphens', () => {
  expect(generateSlug('  -Gown-  ')).toBe('gown')
})

it('returns an empty string for an all-punctuation input', () => {
  expect(generateSlug('!!!')).toBe('')
})
```

### Implementation (exact code from plan):

```ts
export function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

### ProductForm changes:
- Add import after line 10 (`import type { Category } from '@/types';`):
  ```ts
  import { generateSlug } from '@/lib/slug';
  ```
- Delete the local function definition at lines 121-129 (the 9-line `generateSlug` function)
- Leave `handleNameChange` untouched — it now resolves to the imported function

## Verification steps:
1. Run tests: `npx vitest run __tests__/lib/slug.test.ts` → all 5 pass
2. Type check: `npx tsc --noEmit` → no errors
3. Verify no regressions in ProductForm behavior

## Global Constraints
- TypeScript strict mode must be maintained
- No dark mode, no CSS modules
- Tests use Vitest (colocated or in `__tests__/lib/`)
- Reuse existing patterns (no new abstractions beyond what's needed)

## Report File
Report implementation to: `.superpowers/sdd/bulk-task-1-report.md`
Format: status, what was implemented, any concerns (if DONE_WITH_CONCERNS).
