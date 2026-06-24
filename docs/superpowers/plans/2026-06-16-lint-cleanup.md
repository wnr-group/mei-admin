# MEI-27/28 Lint Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all 41 ESLint errors on `feature/mei-27-mei-28-product-fixes` without touching any runtime behavior, UI output, or test assertions.

**Architecture:** Three classes of errors — missing `displayName` on anonymous React wrapper components in tests, `no-explicit-any` type annotations across test and source files, and `set-state-in-effect` in three UI dialogs. Each phase is self-contained and independently verifiable with `npm run lint`.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Vitest, ESLint (`react/display-name`, `@typescript-eslint/no-explicit-any`, `react-hooks/set-state-in-effect`)

---

## Error Inventory

| # | Rule | File | Lines |
|---|------|------|-------|
| 1–6 | `react/display-name` | 6 test files | see Task 1 |
| 7–21 | `no-explicit-any` | 8 files | see Tasks 2–5 |
| 22–35 | `no-explicit-any` | mock chains in 2 test files | see Task 3 |
| 36–38 | `set-state-in-effect` | 3 dialog components | see Tasks 6–8 |

---

## Task 0: Safety Baseline

**Files:**
- No files modified — record only

- [ ] **Step 1: Create baseline branch**

```bash
git checkout feature/mei-27-mei-28-product-fixes
git pull
git checkout -b fix/mei-27-mei-28-lint-cleanup
```

- [ ] **Step 2: Record baseline lint output**

```bash
npm run lint 2>&1 | tee lint-before.txt
```

Expected: 68 problems (41 errors, 27 warnings). Keep this file — it's your before/after comparison.

- [ ] **Step 3: Record baseline test output**

```bash
npx vitest run 2>&1 | tee tests-before.txt
```

Save `tests-before.txt`. Every test that passes now must still pass after all tasks.

---

## Task 1: Fix `react/display-name` (6 errors)

**Files:**
- Modify: `__tests__/hooks/useProductColors.test.ts` line 15–19
- Modify: `__tests__/hooks/useProductVariants.test.ts` line 16–20
- Modify: `tests/hooks/useBlouseConfig.test.ts` line 10–14
- Modify: `tests/hooks/useMeasurementTemplates.test.ts` line 10–14
- Modify: `tests/hooks/useProductMedia.test.ts` line 11–15
- Modify: `tests/hooks/useSizeSystems.test.ts` line 7–11

The lint rule fires on anonymous arrow functions returned from factory functions. React requires every component function to have a `displayName`. The fix is to assign the arrow function to a named variable before returning it, then set `.displayName`.

**Do NOT change:** QueryClient setup, provider structure, test logic, assertions.

- [ ] **Step 1: Fix `__tests__/hooks/useProductColors.test.ts`**

Current (lines 15–19):
```ts
function createWrapper() {
  const queryClient = new QueryClient()
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}
```

Replace with:
```ts
function createWrapper() {
  const queryClient = new QueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  Wrapper.displayName = 'Wrapper'
  return Wrapper
}
```

- [ ] **Step 2: Fix `__tests__/hooks/useProductVariants.test.ts`**

Current (lines 16–20):
```ts
function createWrapper() {
  const queryClient = new QueryClient()
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}
```

Replace with:
```ts
function createWrapper() {
  const queryClient = new QueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  Wrapper.displayName = 'Wrapper'
  return Wrapper
}
```

- [ ] **Step 3: Fix `tests/hooks/useBlouseConfig.test.ts`**

Current (lines 10–14):
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};
```

Replace with:
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'Wrapper';
  return Wrapper;
};
```

- [ ] **Step 4: Fix `tests/hooks/useMeasurementTemplates.test.ts`**

Current (lines 10–14):
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};
```

Replace with:
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'Wrapper';
  return Wrapper;
};
```

- [ ] **Step 5: Fix `tests/hooks/useProductMedia.test.ts`**

Current (lines 11–15):
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};
```

Replace with:
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'Wrapper';
  return Wrapper;
};
```

- [ ] **Step 6: Fix `tests/hooks/useSizeSystems.test.ts`**

Current (lines 7–11):
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};
```

Replace with:
```ts
const createWrapper = () => {
  const queryClient = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'Wrapper';
  return Wrapper;
};
```

- [ ] **Step 7: Verify — 6 display-name errors gone**

```bash
npm run lint 2>&1 | grep "display-name"
```

Expected: no output (no matches).

- [ ] **Step 8: Commit**

```bash
git add __tests__/hooks/useProductColors.test.ts __tests__/hooks/useProductVariants.test.ts tests/hooks/useBlouseConfig.test.ts tests/hooks/useMeasurementTemplates.test.ts tests/hooks/useProductMedia.test.ts tests/hooks/useSizeSystems.test.ts
git commit -m "fix(tests): add displayName to anonymous wrapper components"
```

---

## Task 2: Fix `no-explicit-any` in `check-db.ts` and component prop types

**Files:**
- Modify: `check-db.ts` line 43
- Modify: `components/products/ProductEditTabs.tsx` line 10
- Modify: `components/products/tabs/BasicInfoTab.tsx` line 3

These are the simplest `any` fixes — straightforward type replacements with no logic changes.

- [ ] **Step 1: Fix `check-db.ts` line 43**

Current line 43:
```ts
  const categories: any = await catRes.json()
```

`categories` is used only for `.length` and `[0].id`. Replace with an inline type:

```ts
  const categories = await catRes.json() as Array<{ id: string }>
```

- [ ] **Step 2: Fix `components/products/ProductEditTabs.tsx` line 10**

Current line 10:
```ts
export default function ProductEditTabs({ productId, product }: { productId: string; product: any }) {
```

`product` is not used inside the component body — it's just passed through. Replace `any` with `unknown`:

```ts
export default function ProductEditTabs({ productId, product }: { productId: string; product: unknown }) {
```

- [ ] **Step 3: Fix `components/products/tabs/BasicInfoTab.tsx` line 3**

Current line 3:
```ts
export default function BasicInfoTab({ productId, product }: { productId: string; product: any }) {
```

Neither `productId` nor `product` are used in the component body. Replace `any` with `unknown`:

```ts
export default function BasicInfoTab({ productId, product }: { productId: string; product: unknown }) {
```

- [ ] **Step 4: Verify — 3 errors gone**

```bash
npm run lint 2>&1 | grep -E "(check-db|ProductEditTabs|BasicInfoTab)"
```

Expected: no error lines (warnings for unused params in BasicInfoTab are acceptable — they are warnings, not errors).

- [ ] **Step 5: Commit**

```bash
git add check-db.ts components/products/ProductEditTabs.tsx components/products/tabs/BasicInfoTab.tsx
git commit -m "fix(types): replace any with unknown/specific types in component props and check-db"
```

---

## Task 3: Fix `no-explicit-any` in test mock chains

**Files:**
- Modify: `__tests__/services/product-colors.test.ts` line 1 (import) and line 111
- Modify: `__tests__/services/product-variants.test.ts` line 1 (import) and lines 138, 161, 184, 207, 230, 253, 333, 334, 335, 346, 347, 348

All `any` usages here are in two patterns:
1. `(chain.insert as any).mock.calls[0][0]` — accessing vitest mock internals
2. Inline `then`/`catch`/`finally` callbacks typed as `any`

The fix for pattern 1: import `Mock` from vitest and cast to `Mock` instead of `any`.
The fix for pattern 2: use the same callback types already defined on the `MockChain` interface at the top of each file.

- [ ] **Step 1: Fix `__tests__/services/product-colors.test.ts`**

Change line 1 from:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
```
To:
```ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
```

Change line 111 from:
```ts
    const insertCall = (chain.insert as any).mock.calls[0][0]
```
To:
```ts
    const insertCall = (chain.insert as Mock).mock.calls[0][0]
```

- [ ] **Step 2: Fix `__tests__/services/product-variants.test.ts` — import**

Change line 1 from:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
```
To:
```ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
```

- [ ] **Step 3: Fix `__tests__/services/product-variants.test.ts` — mock.calls casts (6 occurrences)**

Replace all six occurrences of `(chain.insert as any).mock.calls[0][0]` with `(chain.insert as Mock).mock.calls[0][0]`.

Affected lines: 138, 161, 184, 207, 230, 253. Each looks like:
```ts
    const insertCall = (chain.insert as any).mock.calls[0][0]
```
→
```ts
    const insertCall = (chain.insert as Mock).mock.calls[0][0]
```

- [ ] **Step 4: Fix `__tests__/services/product-variants.test.ts` — inline mock `then`/`catch`/`finally` (lines 333–335)**

Current (lines 330–336):
```ts
      then: (onFulfilled?: any) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).then(onFulfilled),
      catch: (onRejected?: any) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).catch(onRejected),
      finally: (onFinally?: any) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).finally(onFinally),
```

Replace with (matching the `MockChain` interface types already in the file):
```ts
      then: (onFulfilled?: ((value: unknown) => unknown) | null) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).then(onFulfilled),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).catch(onRejected),
      finally: (onFinally?: (() => void) | null) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).finally(onFinally),
```

- [ ] **Step 5: Fix `__tests__/services/product-variants.test.ts` — inline mock `then`/`catch`/`finally` (lines 346–348)**

Current (lines 343–349):
```ts
      then: (onFulfilled?: any) => Promise.resolve({ data: { price: 10000 }, error: null }).then(onFulfilled),
      catch: (onRejected?: any) => Promise.resolve({ data: { price: 10000 }, error: null }).catch(onRejected),
      finally: (onFinally?: any) => Promise.resolve({ data: { price: 10000 }, error: null }).finally(onFinally),
```

Replace with:
```ts
      then: (onFulfilled?: ((value: unknown) => unknown) | null) => Promise.resolve({ data: { price: 10000 }, error: null }).then(onFulfilled),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise.resolve({ data: { price: 10000 }, error: null }).catch(onRejected),
      finally: (onFinally?: (() => void) | null) => Promise.resolve({ data: { price: 10000 }, error: null }).finally(onFinally),
```

- [ ] **Step 6: Verify — 16 errors gone**

```bash
npm run lint 2>&1 | grep -E "(product-colors|product-variants)"
```

Expected: only warnings remain (if any), no errors.

- [ ] **Step 7: Run tests — mock behavior unchanged**

```bash
npx vitest run __tests__/services/ 2>&1 | tail -5
```

Expected: same pass/fail ratio as `tests-before.txt`.

- [ ] **Step 8: Commit**

```bash
git add __tests__/services/product-colors.test.ts __tests__/services/product-variants.test.ts
git commit -m "fix(tests): replace any with Mock type in vitest mock chain assertions"
```

---

## Task 4: Fix `no-explicit-any` — `catch (error: any)` in service tests

**Files:**
- Modify: `tests/services/blouse-config.test.ts` lines 19, 43, 66, 97, 117, 142
- Modify: `tests/services/measurement-templates.test.ts` lines 28, 53, 72, 91, 116

Every catch block follows the same pattern:
```ts
} catch (error: any) {
  if (error?.message?.includes('permission')) {
```

The fix: change `any` to `unknown` and cast when accessing `.message`.

**Do NOT change:** the surrounding try/test logic, the `console.warn` calls, or the `expect(true).toBe(true)` guards.

- [ ] **Step 1: Fix all catch blocks in `tests/services/blouse-config.test.ts`**

There are 6 occurrences. For each, change:
```ts
    } catch (error: any) {
      // RLS or auth errors are expected in test environment without authenticated client
      if (error?.message?.includes('permission')) {
```
To:
```ts
    } catch (error: unknown) {
      // RLS or auth errors are expected in test environment without authenticated client
      if ((error as Error)?.message?.includes('permission')) {
```

The 6 locations are at lines 19, 43, 66, 97, 117, 142 (each in a separate `test()` block).

- [ ] **Step 2: Fix all catch blocks in `tests/services/measurement-templates.test.ts`**

There are 5 occurrences. For each, change:
```ts
    } catch (error: any) {
      if (error?.message?.includes('permission')) {
```
To:
```ts
    } catch (error: unknown) {
      if ((error as Error)?.message?.includes('permission')) {
```

The 5 locations are at lines 28, 53, 72, 91, 116.

- [ ] **Step 3: Verify — 11 errors gone**

```bash
npm run lint 2>&1 | grep -E "(blouse-config|measurement-templates)"
```

Expected: no error lines remain.

- [ ] **Step 4: Commit**

```bash
git add tests/services/blouse-config.test.ts tests/services/measurement-templates.test.ts
git commit -m "fix(tests): change catch(error: any) to catch(error: unknown) in service tests"
```

---

## Task 5: Fix `no-explicit-any` in `tests/database/schema-verification.test.ts`

**Files:**
- Modify: `tests/database/schema-verification.test.ts` lines 36–37, 123–125

Both test functions declare cleanup variables typed as `any` that hold Supabase query results. They are only used for `.id` access in cleanup queries.

- [ ] **Step 1: Fix test at line 36 (`product_variants unique index prevents duplicates`)**

Current (lines 36–37):
```ts
    let testColor: any = null;
    let testVariant1: any = null;
```

Replace with:
```ts
    let testColor: { id: string } | null = null;
    let testVariant1: { id: string } | null = null;
```

- [ ] **Step 2: Fix test at lines 123–125 (`Soft-deleted variant + new same combo allowed`)**

Current (lines 123–125):
```ts
    let testColor: any = null;
    let testVariant1: any = null;
    let testVariant2: any = null;
```

Replace with:
```ts
    let testColor: { id: string } | null = null;
    let testVariant1: { id: string } | null = null;
    let testVariant2: { id: string } | null = null;
```

- [ ] **Step 3: Verify — 6 errors gone**

```bash
npm run lint 2>&1 | grep "schema-verification"
```

Expected: only warnings (unused `data` and `v2` variables — these are warnings, not errors; leave them unless the next step addresses them).

- [ ] **Step 4: Commit**

```bash
git add tests/database/schema-verification.test.ts
git commit -m "fix(tests): type schema-verification test cleanup variables as {id: string} | null"
```

---

## Task 6: Fix `set-state-in-effect` — `ColorFormDialog.tsx`

**Files:**
- Modify: `components/products/colors/ColorFormDialog.tsx` lines 3, 23–29

**Background:** The `react-hooks/set-state-in-effect` rule forbids calling `setState` synchronously in `useEffect` bodies. The fix is to eliminate the effect entirely and instead use React's documented "derived state during render" pattern: detect when watched props change by comparing to a stored `useRef`, and call `setState` from the render function body (not inside an effect). React batches these setState calls and re-renders once before painting.

**Behavior preserved:** state resets to `initialColor` values whenever the dialog transitions to `open=true` or `initialColor` changes while open.

- [ ] **Step 1: Replace `useEffect` with `useRef` in import**

Change line 3 from:
```ts
import { useState, useEffect } from 'react'
```
To:
```ts
import { useState, useRef } from 'react'
```

- [ ] **Step 2: Remove the `useEffect` block (lines 23–29)**

Delete:
```ts
  useEffect(() => {
    if (open) {
      setLabel(initialColor?.label ?? '')
      setHexCode(initialColor?.hex_code ?? '')
      setSwatchUrl(initialColor?.swatch_image_url ?? '')
    }
  }, [open, initialColor])
```

- [ ] **Step 3: Add derived-state-during-render block after the mutation hooks (before `if (!open) return null`)**

After line 21 (`const isPending = createColor.isPending || updateColor.isPending`), add:

```ts
  const prevOpenRef = useRef(open)
  const prevColorRef = useRef(initialColor)
  if (open !== prevOpenRef.current || initialColor !== prevColorRef.current) {
    prevOpenRef.current = open
    prevColorRef.current = initialColor
    if (open) {
      setLabel(initialColor?.label ?? '')
      setHexCode(initialColor?.hex_code ?? '')
      setSwatchUrl(initialColor?.swatch_image_url ?? '')
    }
  }
```

The full component top after the change (lines 1–34):
```ts
'use client'

import { useState, useRef } from 'react'
import { useCreateColor, useUpdateColor } from '@/hooks/use-product-colors'
import type { ProductColor } from '@/services/product-colors'

interface Props {
  productId: string
  open: boolean
  onClose: () => void
  initialColor?: ProductColor
}

export default function ColorFormDialog({ productId, open, onClose, initialColor }: Props) {
  const [label, setLabel] = useState('')
  const [hexCode, setHexCode] = useState('')
  const [swatchUrl, setSwatchUrl] = useState('')

  const createColor = useCreateColor(productId)
  const updateColor = useUpdateColor(productId)
  const isPending = createColor.isPending || updateColor.isPending

  const prevOpenRef = useRef(open)
  const prevColorRef = useRef(initialColor)
  if (open !== prevOpenRef.current || initialColor !== prevColorRef.current) {
    prevOpenRef.current = open
    prevColorRef.current = initialColor
    if (open) {
      setLabel(initialColor?.label ?? '')
      setHexCode(initialColor?.hex_code ?? '')
      setSwatchUrl(initialColor?.swatch_image_url ?? '')
    }
  }

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
```

- [ ] **Step 4: Verify — 1 error gone**

```bash
npm run lint 2>&1 | grep "ColorFormDialog"
```

Expected: no output.

- [ ] **Step 5: Manual UI verification**

Start the dev server (`npm run dev`), navigate to Products → any product → Colors tab.

Test each flow:
- **Create:** click "Add Color", form should be empty
- **Edit:** click edit on an existing color, fields should populate with its values
- **Cancel (reopen):** close dialog, reopen with different color, new values should appear
- **Save:** submit form, color should save successfully

If any field is wrong or stale, the fix must be reverted.

- [ ] **Step 6: Commit**

```bash
git add components/products/colors/ColorFormDialog.tsx
git commit -m "fix(ui): remove set-state-in-effect from ColorFormDialog using derived state during render"
```

---

## Task 7: Fix `set-state-in-effect` — `BlouseConfigurationCard.tsx`

**Files:**
- Modify: `components/products/customization/BlouseConfigurationCard.tsx` lines 3, 24–30

**Background:** `config` is async data from a React Query hook. The existing `useEffect` syncs local form state when query data arrives. The fix is the same "derived state during render" pattern — compare `config` to a stored ref and call setters from the render body when it changes.

**Behavior preserved:** local form state (`includesBlouse`, `stitchingOptions`, `templateId`) resets to database values whenever the query returns new `config` data.

- [ ] **Step 1: Replace `useEffect` with `useRef` in import**

Change line 3 from:
```ts
import { useState, useEffect } from 'react'
```
To:
```ts
import { useState, useRef } from 'react'
```

- [ ] **Step 2: Remove the `useEffect` block (lines 24–30)**

Delete:
```ts
  useEffect(() => {
    if (config) {
      setIncludesBlouse(config.includes_blouse)
      setStitchingOptions(config.stitching_options ?? ['STITCHED', 'UNSTITCHED'])
      setTemplateId(config.blouse_measurement_template_id ?? undefined)
    }
  }, [config])
```

- [ ] **Step 3: Add derived-state-during-render block after the `useState` declarations**

After `const [templateId, setTemplateId] = useState<string | undefined>()` (line 22), add:

```ts
  const prevConfigRef = useRef(config)
  if (config !== prevConfigRef.current) {
    prevConfigRef.current = config
    if (config) {
      setIncludesBlouse(config.includes_blouse)
      setStitchingOptions(config.stitching_options ?? ['STITCHED', 'UNSTITCHED'])
      setTemplateId(config.blouse_measurement_template_id ?? undefined)
    }
  }
```

The component top after the change (lines 1–42):
```ts
'use client'

import { useState, useRef } from 'react'
import { useBlouseConfig, useUpsertBlouseConfig } from '@/lib/hooks/useBlouseConfig'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import StitchingOptionsSelector from './StitchingOptionsSelector'
import TemplateMappingSelector from './TemplateMappingSelector'
import type { CustomizationType } from '@/lib/services/blouse-config'

interface Props {
  productId: string
  customizationType?: CustomizationType
}

export default function BlouseConfigurationCard({ productId, customizationType }: Props) {
  const { data: config, isLoading, error, refetch } = useBlouseConfig(productId, customizationType)
  const upsert = useUpsertBlouseConfig(productId)

  const [includesBlouse, setIncludesBlouse] = useState(true)
  const [stitchingOptions, setStitchingOptions] = useState<string[]>(['STITCHED', 'UNSTITCHED'])
  const [templateId, setTemplateId] = useState<string | undefined>()

  const prevConfigRef = useRef(config)
  if (config !== prevConfigRef.current) {
    prevConfigRef.current = config
    if (config) {
      setIncludesBlouse(config.includes_blouse)
      setStitchingOptions(config.stitching_options ?? ['STITCHED', 'UNSTITCHED'])
      setTemplateId(config.blouse_measurement_template_id ?? undefined)
    }
  }

  async function handleSave() {
    await upsert.mutateAsync({
      product_id: productId,
      customization_type: customizationType,
      includes_blouse: includesBlouse,
      stitching_options: stitchingOptions,
    })
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (error) return <ErrorState message="Could not load blouse configuration." onRetry={refetch} />
```

- [ ] **Step 4: Verify — 1 error gone**

```bash
npm run lint 2>&1 | grep "BlouseConfigurationCard"
```

Expected: no output.

- [ ] **Step 5: Manual UI verification**

Navigate to Products → any product → Customization tab.

Test:
- **Load:** blouse configuration should show saved values from database
- **Edit:** toggle "Includes Blouse", change stitching options, save — values persist
- **Reload:** refresh page, database values re-populate the card

If saved values don't load or edits don't save, revert.

- [ ] **Step 6: Commit**

```bash
git add components/products/customization/BlouseConfigurationCard.tsx
git commit -m "fix(ui): remove set-state-in-effect from BlouseConfigurationCard using derived state during render"
```

---

## Task 8: Fix `set-state-in-effect` — `VariantFormDialog.tsx`

**Files:**
- Modify: `components/products/variants/VariantFormDialog.tsx` lines 3, 36–49

**Background:** This dialog has two branches in its `useEffect`: populate from `initialVariant` (edit mode) or reset to defaults (create mode). The fix uses the same pattern as Task 6 — `useRef` for both tracked props (`open` and `initialVariant`).

**Behavior preserved:** form fields populate from `initialVariant` on edit; reset to defaults when `open` transitions to true in create mode.

- [ ] **Step 1: Replace `useEffect` with `useRef` in import**

Change line 3 from:
```ts
import { useState, useEffect } from 'react'
```
To:
```ts
import { useState, useRef } from 'react'
```

- [ ] **Step 2: Remove the `useEffect` block (lines 36–49)**

Delete:
```ts
  useEffect(() => {
    if (open && initialVariant) {
      setColorId(initialVariant.color_id ?? '')
      setSizeLabel(initialVariant.size_label ?? '')
      setCustType(initialVariant.customization_type)
      setPriceOverride(initialVariant.price_override?.toString() ?? '')
      setStockQty(initialVariant.stock_quantity.toString())
      setTrackInventory(initialVariant.track_inventory)
      setIsAvailable(initialVariant.is_available)
    } else if (open) {
      setColorId(''); setSizeLabel(''); setCustType('STANDARD_SIZE')
      setPriceOverride(''); setStockQty('0'); setTrackInventory(false); setIsAvailable(true)
    }
  }, [open, initialVariant])
```

- [ ] **Step 3: Add derived-state-during-render block after the `useState` declarations**

After `const [isAvailable, setIsAvailable] = useState(true)` (line 34), add:

```ts
  const prevOpenRef = useRef(open)
  const prevVariantRef = useRef(initialVariant)
  if (open !== prevOpenRef.current || initialVariant !== prevVariantRef.current) {
    prevOpenRef.current = open
    prevVariantRef.current = initialVariant
    if (open && initialVariant) {
      setColorId(initialVariant.color_id ?? '')
      setSizeLabel(initialVariant.size_label ?? '')
      setCustType(initialVariant.customization_type)
      setPriceOverride(initialVariant.price_override?.toString() ?? '')
      setStockQty(initialVariant.stock_quantity.toString())
      setTrackInventory(initialVariant.track_inventory)
      setIsAvailable(initialVariant.is_available)
    } else if (open) {
      setColorId(''); setSizeLabel(''); setCustType('STANDARD_SIZE')
      setPriceOverride(''); setStockQty('0'); setTrackInventory(false); setIsAvailable(true)
    }
  }
```

The component top after the change (lines 1–55):
```ts
'use client'

import { useState, useRef } from 'react'
import { useCreateVariant, useUpdateVariant } from '@/hooks/use-product-variants'
import { useProductColors } from '@/hooks/use-product-colors'
import type { ProductVariant, ProductVariantInsert, CustomizationType } from '@/services/product-variants'

const CUSTOMIZATION_TYPES: CustomizationType[] = ['UNSTITCHED', 'SEMI_STITCHED', 'STANDARD_SIZE', 'CUSTOM_TAILORED']
const TYPE_LABELS: Record<CustomizationType, string> = {
  UNSTITCHED: 'Unstitched',
  SEMI_STITCHED: 'Semi Stitched',
  STANDARD_SIZE: 'Standard Size',
  CUSTOM_TAILORED: 'Custom Tailored',
}

interface Props {
  productId: string
  open: boolean
  onClose: () => void
  initialVariant?: ProductVariant
}

export default function VariantFormDialog({ productId, open, onClose, initialVariant }: Props) {
  const { data: colors } = useProductColors(productId)
  const createVariant = useCreateVariant(productId)
  const updateVariant = useUpdateVariant(productId)

  const [colorId, setColorId] = useState('')
  const [sizeLabel, setSizeLabel] = useState('')
  const [custType, setCustType] = useState<CustomizationType>('STANDARD_SIZE')
  const [priceOverride, setPriceOverride] = useState('')
  const [stockQty, setStockQty] = useState('0')
  const [trackInventory, setTrackInventory] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)

  const prevOpenRef = useRef(open)
  const prevVariantRef = useRef(initialVariant)
  if (open !== prevOpenRef.current || initialVariant !== prevVariantRef.current) {
    prevOpenRef.current = open
    prevVariantRef.current = initialVariant
    if (open && initialVariant) {
      setColorId(initialVariant.color_id ?? '')
      setSizeLabel(initialVariant.size_label ?? '')
      setCustType(initialVariant.customization_type)
      setPriceOverride(initialVariant.price_override?.toString() ?? '')
      setStockQty(initialVariant.stock_quantity.toString())
      setTrackInventory(initialVariant.track_inventory)
      setIsAvailable(initialVariant.is_available)
    } else if (open) {
      setColorId(''); setSizeLabel(''); setCustType('STANDARD_SIZE')
      setPriceOverride(''); setStockQty('0'); setTrackInventory(false); setIsAvailable(true)
    }
  }

  if (!open) return null
```

- [ ] **Step 4: Verify — 1 error gone**

```bash
npm run lint 2>&1 | grep "VariantFormDialog"
```

Expected: no output.

- [ ] **Step 5: Manual UI verification**

Navigate to Products → any product → Colors & Variants tab.

Test:
- **Create variant:** click "Add Variant", all fields should be at defaults (empty/STANDARD_SIZE/0 stock)
- **Edit variant:** click edit on existing variant, fields should populate with its values
- **Cancel then reopen:** close, reopen with different variant, new values should appear
- **Save:** form submits and variant saves correctly

If any field shows wrong values or create mode shows stale edit data, revert.

- [ ] **Step 6: Commit**

```bash
git add components/products/variants/VariantFormDialog.tsx
git commit -m "fix(ui): remove set-state-in-effect from VariantFormDialog using derived state during render"
```

---

## Task 9: (Optional) Fix Warning-Level Unused Imports/Variables

These are **warnings**, not errors. CI passes with warnings. Fix them only if you want a fully clean lint output.

**Files:**
- `__tests__/components/products/colors/ColorFormDialog.test.tsx` line 2 — `beforeEach` imported, never used → remove from import
- `__tests__/hooks/useProductColors.test.ts` line 1 — `beforeEach` already used (no change needed; verify)
- `app/(app)/enquiries/[id]/page.tsx` line 10 — `const router = useRouter()` unused → remove
- `app/(app)/orders/[id]/page.tsx` line 10 — `const router = useRouter()` unused → remove
- `app/(app)/products/[id]/edit/page.tsx` line 5 — `TabsContent` imported, never used → remove from import
- `hooks/use-product-colors.ts` line 4 — `ProductColorInsert`, `ProductColorUpdate` imported, never used → remove from import
- `hooks/use-product-variants.ts` line 4 — `ProductVariantInsert`, `ProductVariantUpdate` imported, never used → remove from import
- `hooks/use-reorder-media.ts` line 21 — `colorId` param never used → rename to `_colorId`
- `lib/hooks/useMeasurementTemplates.ts` line 7 — `CustomizationType` imported, never used → remove from import
- `tests/database/schema-verification.test.ts` line 22 — `data` never used → rename to `_data`
- `tests/database/schema-verification.test.ts` line 76 — `v2` never used → rename to `_v2`
- `tests/hooks/useBlouseConfig.test.ts` line 1 — `waitFor` imported, never used → remove from import
- `tests/hooks/useMeasurementTemplates.test.ts` line 1 — `waitFor` imported, never used → remove from import
- `tests/hooks/useProductMedia.test.ts` line 76 — `mediaResult` assigned, never used → rename to `_mediaResult`
- `tests/services/measurement-templates.test.ts` line 13 — `templateId` assigned, never used → prefix with `_`

**Verify after:** `npm run lint 2>&1 | grep -c warning` — count should drop significantly.

---

## Task 10: Final Verification

- [ ] **Step 1: Run lint — confirm zero errors**

```bash
npm run lint 2>&1
```

Expected last line:
```
✖ N problems (0 errors, N warnings)
```
or:
```
✔ 0 problems
```

Zero errors is required. Warnings from `@next/next/no-img-element` and remaining unused-var warnings are acceptable.

- [ ] **Step 2: Run tests — confirm no regressions**

```bash
npx vitest run 2>&1 | tail -10
```

Compare to `tests-before.txt`. Every test that was passing before must still pass. If any test that was previously passing now fails, stop and diagnose before proceeding.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes without TypeScript errors. The `unknown` type replacements in Props must not break downstream call sites. If build fails, check that `product: unknown` in `ProductEditTabs` and `BasicInfoTab` didn't create type mismatches in callers.

- [ ] **Step 4: Final commit (if Task 9 was done)**

```bash
git add -p   # review each change
git commit -m "fix(lint): remove unused imports and variables (warning cleanup)"
```

---

## Acceptance Criteria

Mark complete ONLY when ALL of these are true:

- [ ] `npm run lint` reports 0 errors
- [ ] No new warnings introduced beyond pre-existing list
- [ ] All tests that passed in `tests-before.txt` still pass
- [ ] Product create/edit workflow works end-to-end
- [ ] Color create/edit/cancel/reopen dialog works correctly
- [ ] Variant create/edit/cancel/reopen dialog works correctly
- [ ] Blouse configuration loads database values and saves edits
- [ ] Git diff contains only the specific line changes described above — no logic changes, no behavior changes

---

## Key Technical Notes

**Why `useRef` + setState-during-render instead of `useEffect`?**  
The `react-hooks/set-state-in-effect` rule targets synchronous `setState` calls in `useEffect` bodies because they trigger cascading renders and are a known performance footgun. React's documented alternative for "derived state from props" is to call `setState` from the render body with a guard that compares previous values. React detects this and batches the state updates into a single re-render before painting — same user-visible behavior, no cascading.

**Why `{ id: string } | null` for schema-verification variables?**  
The cleanup in `finally` blocks only accesses `.id` — no other properties are needed. Using the minimal required shape instead of `any` satisfies the type checker without inventing types that don't exist.

**Why `(error as Error)?.message` instead of `error?.message`?**  
TypeScript doesn't allow `.message` access on `unknown`. The `catch` block purpose is to check if a permission error occurred — safe to assert `Error` shape since only real Supabase RLS errors reach this branch.
