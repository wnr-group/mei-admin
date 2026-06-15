# Variant System UI — Surgical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 6 phases of missing product UI (Colors, Variants, Media, Measurements, Blouse Config, Size System) into existing placeholder tab components — touching only the 4 stub tab files and creating new component files.

**Architecture:** All backend services and hooks already exist. Each phase creates new component files under `components/products/{domain}/`, adds hook wrappers where needed under `hooks/`, and replaces placeholder content in one of the 4 tab stubs. No existing file is rewritten.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query v5, Supabase JS, Vitest + @testing-library/react, Tailwind CSS v4, lucide-react.

---

## Codebase Orientation

### Existing hooks (DO NOT modify)
- `hooks/use-product-colors.ts` → `useProductColors`, `useCreateColor`, `useUpdateColor`, `useDeleteColor`
- `hooks/use-product-variants.ts` → `useProductVariants`, `useCreateVariant`, `useUpdateVariant`, `useDeleteVariant`
- `lib/hooks/useProductMedia.ts` → `useProductMedia`, `useUploadMedia`, `useDeleteMedia`
- `lib/hooks/useMeasurementTemplates.ts` → `useTemplates`, `useCreateTemplate`
- `lib/hooks/useBlouseConfig.ts` → `useBlouseConfig`, `useUpsertBlouseConfig`
- `lib/hooks/useSizeSystems.ts` → `useSizeSystems`, `useSizeSystemEntries`

### Existing types (import from services, never redefine)
```typescript
// from @/services/product-colors
ProductColor, ProductColorInsert, ProductColorUpdate

// from @/services/product-variants
ProductVariant, ProductVariantInsert, ProductVariantUpdate
CustomizationType = 'UNSTITCHED' | 'SEMI_STITCHED' | 'STANDARD_SIZE' | 'CUSTOM_TAILORED'

// from @/lib/services/product-media
ProductMedia

// from @/lib/services/measurement-templates
MeasurementTemplate, MeasurementFieldKey, CustomizationType

// from @/lib/services/blouse-config
BlouseConfiguration, CustomizationType

// from @/lib/services/size-systems
SizeSystem, SizeSystemEntry
```

### Existing UI components (import, never recreate)
```typescript
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
```

### Design tokens (use everywhere)
- Gold accent: `#c9a465` (buttons, borders, active states)
- Background: `#faf8f5`
- Dialog overlay backdrop: `bg-black/40`
- Container pattern: `bg-white rounded-lg border border-gray-200 p-6`

### Dialog pattern (no library — use this exact structure)
```tsx
{open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
      {/* content */}
    </div>
  </div>
)}
```

### Button classes
```
Primary:   "px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50"
Secondary: "px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
Danger:    "px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
Icon:      "p-1.5 rounded hover:bg-gray-100 text-gray-500"
```

### Test wrapper pattern (use for every hook test)
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}
```

### Run tests
```bash
npx vitest run __tests__/path/to/test.ts
```

### Type check + build
```bash
npx tsc --noEmit
npm run build
```

---

## Phase A — Colors Management UI

### Task 1: ColorFormDialog

**Files:**
- Create: `components/products/colors/ColorFormDialog.tsx`
- Test: `__tests__/components/products/colors/ColorFormDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/products/colors/ColorFormDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-colors', () => ({
  createColor: vi.fn().mockResolvedValue({ id: '1', label: 'Red', product_id: 'p1', sort_order: 0, created_at: '' }),
  updateColor: vi.fn().mockResolvedValue({ id: '1', label: 'Red', product_id: 'p1', sort_order: 0, created_at: '' }),
  getProductColors: vi.fn().mockResolvedValue([]),
  deleteColor: vi.fn(),
}))

const { default: ColorFormDialog } = await import('@/components/products/colors/ColorFormDialog')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('ColorFormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ColorFormDialog productId="p1" open={false} onClose={() => {}} />,
      { wrapper }
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows dialog with Label field when open', () => {
    render(
      <ColorFormDialog productId="p1" open={true} onClose={() => {}} />,
      { wrapper }
    )
    expect(screen.getByLabelText('Label')).toBeInTheDocument()
    expect(screen.getByLabelText('Hex Code')).toBeInTheDocument()
    expect(screen.getByLabelText('Swatch Image URL')).toBeInTheDocument()
  })

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(
      <ColorFormDialog productId="p1" open={true} onClose={onClose} />,
      { wrapper }
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Edit Color title when initialColor provided', () => {
    render(
      <ColorFormDialog
        productId="p1"
        open={true}
        onClose={() => {}}
        initialColor={{ id: '1', label: 'Red', hex_code: '#ff0000', product_id: 'p1', sort_order: 0, created_at: '' }}
      />,
      { wrapper }
    )
    expect(screen.getByText('Edit Color')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/components/products/colors/ColorFormDialog.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```tsx
// components/products/colors/ColorFormDialog.tsx
'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (open) {
      setLabel(initialColor?.label ?? '')
      setHexCode(initialColor?.hex_code ?? '')
      setSwatchUrl(initialColor?.swatch_image_url ?? '')
    }
  }, [open, initialColor])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    if (initialColor) {
      await updateColor.mutateAsync({ id: initialColor.id, input: { label, hex_code: hexCode || undefined, swatch_image_url: swatchUrl || undefined } })
    } else {
      await createColor.mutateAsync({ product_id: productId, label, hex_code: hexCode || undefined, swatch_image_url: swatchUrl || undefined })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{initialColor ? 'Edit Color' : 'Add Color'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="color-label" className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              id="color-label"
              aria-label="Label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
          </div>
          <div>
            <label htmlFor="color-hex" className="block text-sm font-medium text-gray-700 mb-1">Hex Code</label>
            <div className="flex gap-2 items-center">
              <input
                id="color-hex"
                aria-label="Hex Code"
                value={hexCode}
                onChange={e => setHexCode(e.target.value)}
                placeholder="#c9a465"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
              />
              {hexCode && <div className="w-8 h-8 rounded border border-gray-200 shrink-0" style={{ backgroundColor: hexCode }} />}
            </div>
          </div>
          <div>
            <label htmlFor="color-swatch" className="block text-sm font-medium text-gray-700 mb-1">Swatch Image URL</label>
            <input
              id="color-swatch"
              aria-label="Swatch Image URL"
              value={swatchUrl}
              onChange={e => setSwatchUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
          </div>
          {(createColor.error || updateColor.error) && (
            <p className="text-sm text-red-600">Failed to save color. Please try again.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/components/products/colors/ColorFormDialog.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/products/colors/ColorFormDialog.tsx __tests__/components/products/colors/ColorFormDialog.test.tsx
git commit -m "feat: add ColorFormDialog for create/edit color"
```

---

### Task 2: DeleteColorDialog + ColorCard

**Files:**
- Create: `components/products/colors/DeleteColorDialog.tsx`
- Create: `components/products/colors/ColorCard.tsx`
- Test: `__tests__/components/products/colors/ColorCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/products/colors/ColorCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const { default: ColorCard } = await import('@/components/products/colors/ColorCard')

const mockColor = { id: '1', product_id: 'p1', label: 'Ivory White', hex_code: '#FFFFF0', sort_order: 0, created_at: '' }

describe('ColorCard', () => {
  it('renders color label', () => {
    render(<ColorCard color={mockColor} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('Ivory White')).toBeInTheDocument()
  })

  it('renders hex code when present', () => {
    render(<ColorCard color={mockColor} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('#FFFFF0')).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn()
    render(<ColorCard color={mockColor} onEdit={onEdit} onDelete={() => {}} />)
    fireEvent.click(screen.getByTitle('Edit color'))
    expect(onEdit).toHaveBeenCalledWith(mockColor)
  })

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn()
    render(<ColorCard color={mockColor} onEdit={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByTitle('Delete color'))
    expect(onDelete).toHaveBeenCalledWith(mockColor)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/components/products/colors/ColorCard.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create DeleteColorDialog**

```tsx
// components/products/colors/DeleteColorDialog.tsx
'use client'

import { useDeleteColor } from '@/hooks/use-product-colors'
import type { ProductColor } from '@/services/product-colors'

interface Props {
  productId: string
  color: ProductColor | null
  onClose: () => void
}

export default function DeleteColorDialog({ productId, color, onClose }: Props) {
  const deleteColor = useDeleteColor(productId)

  if (!color) return null

  async function handleConfirm() {
    await deleteColor.mutateAsync(color!.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-2">Delete Color</h2>
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{color.label}</strong>? This will also remove associated variants and media.
        </p>
        {deleteColor.error && <p className="text-sm text-red-600 mb-3">Failed to delete. Please try again.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} disabled={deleteColor.isPending} className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
            {deleteColor.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create ColorCard**

```tsx
// components/products/colors/ColorCard.tsx
'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { ProductColor } from '@/services/product-colors'

interface Props {
  color: ProductColor
  onEdit: (color: ProductColor) => void
  onDelete: (color: ProductColor) => void
}

export default function ColorCard({ color, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
      <div
        className="w-10 h-10 rounded-full border border-gray-200 shrink-0 bg-gray-100"
        style={color.hex_code ? { backgroundColor: color.hex_code } : undefined}
      >
        {color.swatch_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={color.swatch_image_url} alt={color.label} className="w-full h-full rounded-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{color.label}</p>
        {color.hex_code && <p className="text-xs text-gray-500">{color.hex_code}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button title="Edit color" onClick={() => onEdit(color)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <Pencil size={14} />
        </button>
        <button title="Delete color" onClick={() => onDelete(color)} className="p-1.5 rounded hover:bg-gray-100 text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run __tests__/components/products/colors/ColorCard.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add components/products/colors/DeleteColorDialog.tsx components/products/colors/ColorCard.tsx __tests__/components/products/colors/ColorCard.test.tsx
git commit -m "feat: add ColorCard and DeleteColorDialog"
```

---

### Task 3: ColorList

**Files:**
- Create: `components/products/colors/ColorList.tsx`
- Test: `__tests__/components/products/colors/ColorList.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/products/colors/ColorList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-colors', () => ({
  getProductColors: vi.fn(),
  createColor: vi.fn(),
  updateColor: vi.fn(),
  deleteColor: vi.fn(),
}))

const { getProductColors } = await import('@/services/product-colors')
const { default: ColorList } = await import('@/components/products/colors/ColorList')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('ColorList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty state when no colors', async () => {
    vi.mocked(getProductColors).mockResolvedValue([])
    render(<ColorList productId="p1" />, { wrapper })
    expect(await screen.findByText(/no colors/i)).toBeInTheDocument()
  })

  it('shows Add Color button', () => {
    vi.mocked(getProductColors).mockResolvedValue([])
    render(<ColorList productId="p1" />, { wrapper })
    expect(screen.getByText('Add Color')).toBeInTheDocument()
  })

  it('renders color cards when data exists', async () => {
    vi.mocked(getProductColors).mockResolvedValue([
      { id: '1', product_id: 'p1', label: 'Ivory White', hex_code: '#FFFFF0', sort_order: 0, created_at: '' },
    ])
    render(<ColorList productId="p1" />, { wrapper })
    expect(await screen.findByText('Ivory White')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/components/products/colors/ColorList.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```tsx
// components/products/colors/ColorList.tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useProductColors } from '@/hooks/use-product-colors'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import ColorCard from './ColorCard'
import ColorFormDialog from './ColorFormDialog'
import DeleteColorDialog from './DeleteColorDialog'
import type { ProductColor } from '@/services/product-colors'

export default function ColorList({ productId }: { productId: string }) {
  const { data: colors, isLoading, error, refetch } = useProductColors(productId)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProductColor | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ProductColor | null>(null)

  function openCreate() { setEditTarget(undefined); setFormOpen(true) }
  function openEdit(c: ProductColor) { setEditTarget(c); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditTarget(undefined) }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Colors</h3>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f]">
          <Plus size={14} /> Add Color
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}
      {error && <ErrorState message="Could not load colors." onRetry={refetch} />}
      {!isLoading && !error && colors?.length === 0 && (
        <EmptyState message="No colors yet. Add a color to start managing variants." />
      )}
      {!isLoading && !error && colors && colors.length > 0 && (
        <div className="space-y-2">
          {colors.map(c => (
            <ColorCard key={c.id} color={c} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      <ColorFormDialog productId={productId} open={formOpen} onClose={closeForm} initialColor={editTarget} />
      <DeleteColorDialog productId={productId} color={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/components/products/colors/ColorList.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/products/colors/ColorList.tsx __tests__/components/products/colors/ColorList.test.tsx
git commit -m "feat: add ColorList with CRUD orchestration"
```

---

## Phase B — Variant Management UI

### Task 4: Hook wrappers — SKU generation and bulk create

**Files:**
- Create: `hooks/use-generate-sku.ts`
- Create: `hooks/use-bulk-create-variants.ts`
- Test: `__tests__/hooks/useBulkCreateVariants.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/hooks/useBulkCreateVariants.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    functions: { invoke: vi.fn().mockResolvedValue({ data: [], error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }) }),
  }),
}))

const { useBulkCreateVariants } = await import('@/hooks/use-bulk-create-variants')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('useBulkCreateVariants', () => {
  it('returns a mutation hook', () => {
    const { result } = renderHook(() => useBulkCreateVariants('p1'), { wrapper })
    expect(result.current).toHaveProperty('mutate')
    expect(result.current).toHaveProperty('isPending')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/hooks/useBulkCreateVariants.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create use-generate-sku.ts**

```typescript
// hooks/use-generate-sku.ts
'use client'

import { createClient } from '@supabase/supabase-js'
import type { CustomizationType } from '@/services/product-variants'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateVariantSku(
  productCode: string,
  color: string | null,
  size: string | null,
  type: CustomizationType
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_variant_sku', {
    p_product_code: productCode,
    p_color: color,
    p_size: size,
    p_type: type,
  })
  if (error) throw error
  return data as string
}
```

- [ ] **Step 4: Create use-bulk-create-variants.ts**

```typescript
// hooks/use-bulk-create-variants.ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import type { CustomizationType } from '@/services/product-variants'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface BulkVariantSpec {
  color_id?: string
  size_label: string
  customization_type: CustomizationType
}

async function bulkCreateVariants(productId: string, specs: BulkVariantSpec[]) {
  const { data, error } = await supabase.functions.invoke('bulk-create-variants', {
    body: { product_id: productId, specs },
  })
  if (error) throw error
  return data
}

export function useBulkCreateVariants(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (specs: BulkVariantSpec[]) => bulkCreateVariants(productId, specs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', productId, 'variants'] })
    },
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run __tests__/hooks/useBulkCreateVariants.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add hooks/use-generate-sku.ts hooks/use-bulk-create-variants.ts __tests__/hooks/useBulkCreateVariants.test.ts
git commit -m "feat: add SKU generation utility and bulk-create-variants hook"
```

---

### Task 5: VariantFormDialog

**Files:**
- Create: `components/products/variants/VariantFormDialog.tsx`
- Test: `__tests__/components/products/variants/VariantFormDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/products/variants/VariantFormDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-variants', () => ({
  getProductVariants: vi.fn().mockResolvedValue([]),
  createVariant: vi.fn().mockResolvedValue({ id: '1' }),
  updateVariant: vi.fn().mockResolvedValue({ id: '1' }),
  deleteVariant: vi.fn(),
}))
vi.mock('@/services/product-colors', () => ({
  getProductColors: vi.fn().mockResolvedValue([]),
  createColor: vi.fn(),
  updateColor: vi.fn(),
  deleteColor: vi.fn(),
}))

const { default: VariantFormDialog } = await import('@/components/products/variants/VariantFormDialog')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('VariantFormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<VariantFormDialog productId="p1" open={false} onClose={() => {}} />, { wrapper })
    expect(container.firstChild).toBeNull()
  })

  it('shows customization type select when open', () => {
    render(<VariantFormDialog productId="p1" open={true} onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Customization Type')).toBeInTheDocument()
  })

  it('shows size label input when open', () => {
    render(<VariantFormDialog productId="p1" open={true} onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Size Label')).toBeInTheDocument()
  })

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(<VariantFormDialog productId="p1" open={true} onClose={onClose} />, { wrapper })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/components/products/variants/VariantFormDialog.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```tsx
// components/products/variants/VariantFormDialog.tsx
'use client'

import { useState, useEffect } from 'react'
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

  if (!open) return null

  const isPending = createVariant.isPending || updateVariant.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input: ProductVariantInsert = {
      product_id: productId,
      color_id: colorId || undefined,
      size_label: sizeLabel || undefined,
      customization_type: custType,
      price_override: priceOverride ? parseFloat(priceOverride) : undefined,
      stock_quantity: parseInt(stockQty, 10),
      track_inventory: trackInventory,
      is_available: isAvailable,
    }
    if (initialVariant) {
      await updateVariant.mutateAsync({ id: initialVariant.id, input })
    } else {
      await createVariant.mutateAsync(input)
    }
    onClose()
  }

  const inputCls = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{initialVariant ? 'Edit Variant' : 'Add Variant'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="v-color" className={labelCls}>Color</label>
            <select id="v-color" value={colorId} onChange={e => setColorId(e.target.value)} className={inputCls}>
              <option value="">No color</option>
              {colors?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="v-size" className={labelCls}>Size Label</label>
            <input id="v-size" aria-label="Size Label" value={sizeLabel} onChange={e => setSizeLabel(e.target.value)} placeholder="e.g. 38, Free Size" className={inputCls} />
          </div>
          <div>
            <label htmlFor="v-type" className={labelCls}>Customization Type</label>
            <select id="v-type" aria-label="Customization Type" value={custType} onChange={e => setCustType(e.target.value as CustomizationType)} className={inputCls}>
              {CUSTOMIZATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="v-price" className={labelCls}>Price Override (₹)</label>
            <input id="v-price" type="number" min="0" step="0.01" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} placeholder="Leave blank to use product price" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="v-stock" className={labelCls}>Stock Quantity</label>
              <input id="v-stock" type="number" min="0" value={stockQty} onChange={e => setStockQty(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2 pt-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={trackInventory} onChange={e => setTrackInventory(e.target.checked)} className="accent-[#c9a465]" />
                Track inventory
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="accent-[#c9a465]" />
                Available
              </label>
            </div>
          </div>
          {(createVariant.error || updateVariant.error) && (
            <p className="text-sm text-red-600">Failed to save variant.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/components/products/variants/VariantFormDialog.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/products/variants/VariantFormDialog.tsx __tests__/components/products/variants/VariantFormDialog.test.tsx
git commit -m "feat: add VariantFormDialog for create/edit variant"
```

---

### Task 6: VariantInventoryPanel + VariantGeneratorDialog

**Files:**
- Create: `components/products/variants/VariantInventoryPanel.tsx`
- Create: `components/products/variants/VariantGeneratorDialog.tsx`

- [ ] **Step 1: Create VariantInventoryPanel**

```tsx
// components/products/variants/VariantInventoryPanel.tsx
'use client'

import { useState } from 'react'
import { useUpdateVariant } from '@/hooks/use-product-variants'
import type { ProductVariant } from '@/services/product-variants'

interface Props {
  productId: string
  variant: ProductVariant
}

export default function VariantInventoryPanel({ productId, variant }: Props) {
  const update = useUpdateVariant(productId)
  const [qty, setQty] = useState(variant.stock_quantity.toString())

  async function saveQty() {
    const q = parseInt(qty, 10)
    if (isNaN(q) || q === variant.stock_quantity) return
    await update.mutateAsync({ id: variant.id, input: { stock_quantity: q } })
  }

  async function toggleTrack() {
    await update.mutateAsync({ id: variant.id, input: { track_inventory: !variant.track_inventory } })
  }

  async function toggleAvailable() {
    await update.mutateAsync({ id: variant.id, input: { is_available: !variant.is_available } })
  }

  async function toggleBackorder() {
    await update.mutateAsync({ id: variant.id, input: { allow_backorder: !variant.allow_backorder } })
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <label className="text-gray-600 w-28 shrink-0">Stock qty</label>
        <input
          type="number"
          min="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
          onBlur={saveQty}
          disabled={!variant.track_inventory}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465] disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={variant.track_inventory} onChange={toggleTrack} className="accent-[#c9a465]" />
        <span className="text-gray-600">Track inventory</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={variant.allow_backorder} onChange={toggleBackorder} className="accent-[#c9a465]" />
        <span className="text-gray-600">Allow backorder</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={variant.is_available} onChange={toggleAvailable} className="accent-[#c9a465]" />
        <span className="text-gray-600">Available</span>
      </label>
      {update.isPending && <p className="text-xs text-gray-400">Saving…</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create VariantGeneratorDialog**

```tsx
// components/products/variants/VariantGeneratorDialog.tsx
'use client'

import { useState } from 'react'
import { useProductColors } from '@/hooks/use-product-colors'
import { useBulkCreateVariants, type BulkVariantSpec } from '@/hooks/use-bulk-create-variants'
import type { CustomizationType } from '@/services/product-variants'

const CUSTOMIZATION_TYPES: CustomizationType[] = ['UNSTITCHED', 'SEMI_STITCHED', 'STANDARD_SIZE', 'CUSTOM_TAILORED']
const TYPE_LABELS: Record<CustomizationType, string> = {
  UNSTITCHED: 'Unstitched', SEMI_STITCHED: 'Semi Stitched', STANDARD_SIZE: 'Standard Size', CUSTOM_TAILORED: 'Custom Tailored',
}

interface Props {
  productId: string
  open: boolean
  onClose: () => void
}

export default function VariantGeneratorDialog({ productId, open, onClose }: Props) {
  const { data: colors } = useProductColors(productId)
  const bulk = useBulkCreateVariants(productId)
  const [colorId, setColorId] = useState('')
  const [custType, setCustType] = useState<CustomizationType>('STANDARD_SIZE')
  const [sizesRaw, setSizesRaw] = useState('34, 36, 38, 40, 42')

  if (!open) return null

  function buildSpecs(): BulkVariantSpec[] {
    const sizes = sizesRaw.split(',').map(s => s.trim()).filter(Boolean)
    return sizes.map(size => ({
      color_id: colorId || undefined,
      size_label: size,
      customization_type: custType,
    }))
  }

  async function handleGenerate() {
    const specs = buildSpecs()
    if (!specs.length) return
    await bulk.mutateAsync(specs)
    onClose()
  }

  const specs = buildSpecs()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Bulk Generate Variants</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color (optional)</label>
            <select value={colorId} onChange={e => setColorId(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]">
              <option value="">No color</option>
              {colors?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customization Type</label>
            <select value={custType} onChange={e => setCustType(e.target.value as CustomizationType)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]">
              {CUSTOMIZATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sizes (comma-separated)</label>
            <input value={sizesRaw} onChange={e => setSizesRaw(e.target.value)} placeholder="34, 36, 38, 40" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]" />
          </div>
          {specs.length > 0 && (
            <p className="text-xs text-gray-500">Will create {specs.length} variant{specs.length !== 1 ? 's' : ''}: {specs.map(s => s.size_label).join(', ')}</p>
          )}
          {bulk.error && <p className="text-sm text-red-600">Failed to generate variants.</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleGenerate} disabled={bulk.isPending || !specs.length} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
            {bulk.isPending ? 'Generating…' : `Generate ${specs.length} Variant${specs.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors in these files

- [ ] **Step 4: Commit**

```bash
git add components/products/variants/VariantInventoryPanel.tsx components/products/variants/VariantGeneratorDialog.tsx
git commit -m "feat: add VariantInventoryPanel and VariantGeneratorDialog"
```

---

### Task 7: VariantTable + update ColorsVariantsTab

**Files:**
- Create: `components/products/variants/VariantTable.tsx`
- Test: `__tests__/components/products/variants/VariantTable.test.tsx`
- Modify: `components/products/tabs/ColorsVariantsTab.tsx` (replace placeholder body only)

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/products/variants/VariantTable.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-variants', () => ({
  getProductVariants: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
}))
vi.mock('@/services/product-colors', () => ({
  getProductColors: vi.fn().mockResolvedValue([]),
  createColor: vi.fn(), updateColor: vi.fn(), deleteColor: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    functions: { invoke: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }) }),
  }),
}))

const { getProductVariants } = await import('@/services/product-variants')
const { default: VariantTable } = await import('@/components/products/variants/VariantTable')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('VariantTable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty state when no variants', async () => {
    vi.mocked(getProductVariants).mockResolvedValue([])
    render(<VariantTable productId="p1" />, { wrapper })
    expect(await screen.findByText(/no variants/i)).toBeInTheDocument()
  })

  it('shows Add Variant button', () => {
    vi.mocked(getProductVariants).mockResolvedValue([])
    render(<VariantTable productId="p1" />, { wrapper })
    expect(screen.getByText('Add Variant')).toBeInTheDocument()
  })

  it('renders variant row when data exists', async () => {
    vi.mocked(getProductVariants).mockResolvedValue([{
      id: 'v1', product_id: 'p1', customization_type: 'STANDARD_SIZE', sku: 'TEST-38-ST',
      stock_quantity: 10, track_inventory: false, allow_backorder: true,
      low_stock_threshold: 5, is_available: true, sort_order: 0, created_at: '', updated_at: '',
    }])
    render(<VariantTable productId="p1" />, { wrapper })
    expect(await screen.findByText('STANDARD_SIZE')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/components/products/variants/VariantTable.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create VariantTable**

```tsx
// components/products/variants/VariantTable.tsx
'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useProductVariants, useDeleteVariant } from '@/hooks/use-product-variants'
import { useProductColors } from '@/hooks/use-product-colors'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import VariantFormDialog from './VariantFormDialog'
import VariantGeneratorDialog from './VariantGeneratorDialog'
import VariantInventoryPanel from './VariantInventoryPanel'
import type { ProductVariant } from '@/services/product-variants'

export default function VariantTable({ productId }: { productId: string }) {
  const { data: variants, isLoading, error, refetch } = useProductVariants(productId)
  const { data: colors } = useProductColors(productId)
  const deleteVariant = useDeleteVariant(productId)

  const [formOpen, setFormOpen] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProductVariant | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const colorMap = Object.fromEntries((colors ?? []).map(c => [c.id, c.label]))

  function openEdit(v: ProductVariant) { setEditTarget(v); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditTarget(undefined) }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Variants</h3>
        <div className="flex gap-2">
          <button onClick={() => setGenOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c9a465] text-[#c9a465] text-sm rounded hover:bg-[#faf8f5]">
            <Zap size={14} /> Bulk Generate
          </button>
          <button onClick={() => { setEditTarget(undefined); setFormOpen(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f]">
            <Plus size={14} /> Add Variant
          </button>
        </div>
      </div>

      {isLoading && <TableSkeleton rows={4} />}
      {error && <ErrorState message="Could not load variants." onRetry={refetch} />}
      {!isLoading && !error && variants?.length === 0 && (
        <EmptyState message="No variants yet. Add a variant or use Bulk Generate." />
      )}
      {!isLoading && !error && variants && variants.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Color</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Size</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Price Override</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Available</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <>
                  <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">{v.color_id ? (colorMap[v.color_id] ?? '—') : '—'}</td>
                    <td className="px-3 py-2">{v.size_label ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{v.customization_type}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{v.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{v.price_override != null ? `₹${v.price_override.toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-2 text-center">{v.track_inventory ? v.stock_quantity : '∞'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${v.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.is_available ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Inventory controls">
                          {expandedId === v.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit variant"><Pencil size={14} /></button>
                        <button onClick={() => deleteVariant.mutate(v.id)} className="p-1.5 rounded hover:bg-gray-100 text-red-500" title="Delete variant"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === v.id && (
                    <tr key={`${v.id}-inv`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={8} className="px-6 py-3">
                        <VariantInventoryPanel productId={productId} variant={v} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VariantFormDialog productId={productId} open={formOpen} onClose={closeForm} initialVariant={editTarget} />
      <VariantGeneratorDialog productId={productId} open={genOpen} onClose={() => setGenOpen(false)} />
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/components/products/variants/VariantTable.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Update ColorsVariantsTab (replace placeholder only)**

Replace ONLY the return body — do not touch props or imports that already exist:

```tsx
// components/products/tabs/ColorsVariantsTab.tsx
'use client';

import ColorList from '@/components/products/colors/ColorList'
import VariantTable from '@/components/products/variants/VariantTable'

export default function ColorsVariantsTab({ productId }: { productId: string }) {
  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-6">Colors & Variants</h2>
      <ColorList productId={productId} />
      <VariantTable productId={productId} />
    </div>
  );
}
```

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add components/products/variants/VariantTable.tsx __tests__/components/products/variants/VariantTable.test.tsx components/products/tabs/ColorsVariantsTab.tsx
git commit -m "feat: add VariantTable and wire ColorsVariantsTab"
```

---

## Phase C — Media Gallery UI

### Task 8: Hook wrappers + MediaCard + MediaUploader

**Files:**
- Create: `hooks/use-set-primary-media.ts`
- Create: `hooks/use-reorder-media.ts`
- Create: `components/products/media/MediaCard.tsx`
- Create: `components/products/media/MediaUploader.tsx`

- [ ] **Step 1: Create use-set-primary-media.ts**

```typescript
// hooks/use-set-primary-media.ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function setPrimaryMedia(mediaId: string, productId: string, colorId?: string) {
  const { error } = await supabase.functions.invoke('set-primary-media', {
    body: { media_id: mediaId, product_id: productId, color_id: colorId ?? null },
  })
  if (error) throw error
}

export function useSetPrimaryMedia(productId: string, colorId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string) => setPrimaryMedia(mediaId, productId, colorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', productId, 'media'] })
    },
  })
}
```

- [ ] **Step 2: Create use-reorder-media.ts**

```typescript
// hooks/use-reorder-media.ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function reorderMedia(items: { id: string; sort_order: number }[]) {
  for (const item of items) {
    const { error } = await supabase
      .from('product_media')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
    if (error) throw error
  }
}

export function useReorderMedia(productId: string, colorId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) => reorderMedia(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', productId, 'media'] })
    },
  })
}
```

- [ ] **Step 3: Create MediaCard**

```tsx
// components/products/media/MediaCard.tsx
'use client'

import { Trash2, Star, ChevronUp, ChevronDown, Play } from 'lucide-react'
import type { ProductMedia } from '@/lib/services/product-media'

interface Props {
  media: ProductMedia
  onDelete: (id: string) => void
  onSetPrimary: (id: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst: boolean
  isLast: boolean
}

export default function MediaCard({ media, onDelete, onSetPrimary, onMoveUp, onMoveDown, isFirst, isLast }: Props) {
  return (
    <div className={`relative group rounded-lg overflow-hidden border-2 ${media.is_primary ? 'border-[#c9a465]' : 'border-gray-200'}`}>
      <div className="aspect-square bg-gray-100 relative">
        {media.media_type === 'VIDEO' ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <Play size={32} className="text-white" />
            <span className="absolute bottom-1 left-1 text-xs text-white bg-black/60 rounded px-1">VIDEO</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt={media.alt_text ?? ''} className="w-full h-full object-cover" />
        )}
        {media.is_primary && (
          <div className="absolute top-1 left-1 bg-[#c9a465] text-white text-xs px-1.5 py-0.5 rounded font-medium">Primary</div>
        )}
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
        <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFirst && <button onClick={onMoveUp} className="p-1 bg-white rounded shadow text-gray-700 hover:bg-gray-100"><ChevronUp size={12} /></button>}
          {!isLast && <button onClick={onMoveDown} className="p-1 bg-white rounded shadow text-gray-700 hover:bg-gray-100"><ChevronDown size={12} /></button>}
          {!media.is_primary && <button onClick={() => onSetPrimary(media.id)} title="Set as primary" className="p-1 bg-white rounded shadow text-yellow-600 hover:bg-yellow-50"><Star size={12} /></button>}
          <button onClick={() => onDelete(media.id)} title="Delete media" className="p-1 bg-white rounded shadow text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create MediaUploader**

```tsx
// components/products/media/MediaUploader.tsx
'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { useUploadMedia } from '@/lib/hooks/useProductMedia'

interface Props {
  productId: string
  colorId?: string
}

export default function MediaUploader({ productId, colorId }: Props) {
  const [url, setUrl] = useState('')
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE')
  const [altText, setAltText] = useState('')
  const upload = useUploadMedia(productId, colorId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    await upload.mutateAsync({ product_id: productId, url: url.trim(), alt_text: altText || undefined, media_type: mediaType, color_id: colorId })
    setUrl(''); setAltText('')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <Upload size={16} className="text-gray-400 mt-2.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Image or video URL"
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
          />
          <div className="flex gap-2">
            <input
              value={altText}
              onChange={e => setAltText(e.target.value)}
              placeholder="Alt text (optional)"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
            <select value={mediaType} onChange={e => setMediaType(e.target.value as 'IMAGE' | 'VIDEO')} className="border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none">
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
            </select>
            <button type="submit" disabled={upload.isPending || !url.trim()} className="px-3 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50 whitespace-nowrap">
              {upload.isPending ? '…' : 'Add'}
            </button>
          </div>
          {upload.error && <p className="text-xs text-red-600">Failed to add media.</p>}
        </div>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add hooks/use-set-primary-media.ts hooks/use-reorder-media.ts components/products/media/MediaCard.tsx components/products/media/MediaUploader.tsx
git commit -m "feat: add media hook wrappers, MediaCard, MediaUploader"
```

---

### Task 9: MediaGrid + MediaGallery + update MediaGalleryTab

**Files:**
- Create: `components/products/media/MediaGrid.tsx`
- Create: `components/products/media/MediaGallery.tsx`
- Modify: `components/products/tabs/MediaGalleryTab.tsx`

- [ ] **Step 1: Create MediaGrid**

```tsx
// components/products/media/MediaGrid.tsx
'use client'

import { useProductMedia, useDeleteMedia } from '@/lib/hooks/useProductMedia'
import { useSetPrimaryMedia } from '@/hooks/use-set-primary-media'
import { useReorderMedia } from '@/hooks/use-reorder-media'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import MediaCard from './MediaCard'
import MediaUploader from './MediaUploader'
import type { ProductMedia } from '@/lib/services/product-media'

interface Props {
  productId: string
  colorId?: string
}

export default function MediaGrid({ productId, colorId }: Props) {
  const { data: media, isLoading, error, refetch } = useProductMedia(productId, colorId)
  const deleteMedia = useDeleteMedia(productId, colorId)
  const setPrimary = useSetPrimaryMedia(productId, colorId)
  const reorder = useReorderMedia(productId, colorId)

  function moveItem(index: number, direction: -1 | 1) {
    if (!media) return
    const newOrder = [...media]
    const [item] = newOrder.splice(index, 1)
    newOrder.splice(index + direction, 0, item)
    const updates = newOrder.map((m: ProductMedia, i: number) => ({ id: m.id, sort_order: i }))
    reorder.mutate(updates)
  }

  return (
    <div className="space-y-4">
      <MediaUploader productId={productId} colorId={colorId} />
      {isLoading && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-square rounded-lg" />)}
        </div>
      )}
      {error && <ErrorState message="Could not load media." onRetry={refetch} />}
      {!isLoading && !error && media?.length === 0 && <EmptyState message="No media yet. Add an image or video URL above." />}
      {!isLoading && !error && media && media.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {media.map((m, i) => (
            <MediaCard
              key={m.id}
              media={m}
              isFirst={i === 0}
              isLast={i === media.length - 1}
              onDelete={id => deleteMedia.mutate(id)}
              onSetPrimary={id => setPrimary.mutate(id)}
              onMoveUp={() => moveItem(i, -1)}
              onMoveDown={() => moveItem(i, 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create MediaGallery**

```tsx
// components/products/media/MediaGallery.tsx
'use client'

import { useState } from 'react'
import { useProductColors } from '@/hooks/use-product-colors'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import MediaGrid from './MediaGrid'

interface Props {
  productId: string
}

export default function MediaGallery({ productId }: Props) {
  const { data: colors } = useProductColors(productId)
  const [activeTab, setActiveTab] = useState('all')

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Media</TabsTrigger>
          {colors?.map(c => (
            <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="all">
          <MediaGrid productId={productId} />
        </TabsContent>
        {colors?.map(c => (
          <TabsContent key={c.id} value={c.id}>
            <MediaGrid productId={productId} colorId={c.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Update MediaGalleryTab**

```tsx
// components/products/tabs/MediaGalleryTab.tsx
'use client';

import MediaGallery from '@/components/products/media/MediaGallery'

export default function MediaGalleryTab({ productId }: { productId: string }) {
  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Media Gallery</h2>
      <MediaGallery productId={productId} />
    </div>
  );
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/products/media/MediaGrid.tsx components/products/media/MediaGallery.tsx components/products/tabs/MediaGalleryTab.tsx
git commit -m "feat: add MediaGrid, MediaGallery, wire MediaGalleryTab"
```

---

## Phase D — Measurement Templates UI

### Task 10: Template fields hook wrapper

**Files:**
- Create: `hooks/use-template-fields.ts`
- Test: `__tests__/hooks/useTemplateFields.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/hooks/useTemplateFields.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
      upsert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => ({ error: null }) }),
    }),
  }),
}))

const { useTemplateFields, useUpsertTemplateField, useDeleteTemplateField } = await import('@/hooks/use-template-fields')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('useTemplateFields', () => {
  it('returns data, isLoading, error', () => {
    const { result } = renderHook(() => useTemplateFields('t1'), { wrapper })
    expect(result.current).toHaveProperty('data')
  })

  it('useUpsertTemplateField is a mutation', () => {
    const { result } = renderHook(() => useUpsertTemplateField('t1'), { wrapper })
    expect(result.current).toHaveProperty('mutate')
  })

  it('useDeleteTemplateField is a mutation', () => {
    const { result } = renderHook(() => useDeleteTemplateField('t1'), { wrapper })
    expect(result.current).toHaveProperty('mutate')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/hooks/useTemplateFields.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create the hook**

```typescript
// hooks/use-template-fields.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import type { MeasurementFieldKey } from '@/lib/services/measurement-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface TemplateField {
  id: string
  template_id: string
  field_key: MeasurementFieldKey
  is_required: boolean
  sort_order: number
  help_text?: string
  created_at: string
}

const fieldQueryKeys = {
  fields: (templateId: string) => ['mt', templateId, 'fields'] as const,
}

async function getTemplateFields(templateId: string): Promise<TemplateField[]> {
  const { data, error } = await supabase
    .from('measurement_template_fields')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order')
  if (error) throw error
  return data || []
}

async function upsertTemplateField(input: {
  template_id: string
  field_key: MeasurementFieldKey
  is_required?: boolean
  sort_order?: number
  help_text?: string
}): Promise<TemplateField> {
  const { data, error } = await supabase
    .from('measurement_template_fields')
    .upsert(input, { onConflict: 'template_id,field_key' })
    .select()
    .single()
  if (error) throw error
  return data
}

async function deleteTemplateField(id: string): Promise<void> {
  const { error } = await supabase.from('measurement_template_fields').delete().eq('id', id)
  if (error) throw error
}

export function useTemplateFields(templateId: string) {
  return useQuery({
    queryKey: fieldQueryKeys.fields(templateId),
    queryFn: () => getTemplateFields(templateId),
    enabled: !!templateId,
  })
}

export function useUpsertTemplateField(templateId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof upsertTemplateField>[0]) => upsertTemplateField(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fieldQueryKeys.fields(templateId) }),
  })
}

export function useDeleteTemplateField(templateId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTemplateField(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fieldQueryKeys.fields(templateId) }),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/hooks/useTemplateFields.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/use-template-fields.ts __tests__/hooks/useTemplateFields.test.ts
git commit -m "feat: add useTemplateFields hook wrapper for measurement_template_fields"
```

---

### Task 11: MeasurementFieldsTable + MeasurementTemplateEditor + MeasurementTemplateSelector

**Files:**
- Create: `components/products/measurements/MeasurementFieldsTable.tsx`
- Create: `components/products/measurements/MeasurementTemplateEditor.tsx`
- Create: `components/products/measurements/MeasurementTemplateSelector.tsx`
- Modify: `components/products/tabs/MeasurementsTab.tsx`

- [ ] **Step 1: Create MeasurementFieldsTable**

```tsx
// components/products/measurements/MeasurementFieldsTable.tsx
'use client'

import { Trash2 } from 'lucide-react'
import { useTemplateFields, useUpsertTemplateField, useDeleteTemplateField, type TemplateField } from '@/hooks/use-template-fields'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

const ALL_FIELD_KEYS = [
  'bust','waist','hip','shoulder','blouse_length','sleeve_length',
  'lehenga_length','height','custom',
] as const

interface Props {
  templateId: string
}

export default function MeasurementFieldsTable({ templateId }: Props) {
  const { data: fields, isLoading } = useTemplateFields(templateId)
  const upsert = useUpsertTemplateField(templateId)
  const remove = useDeleteTemplateField(templateId)

  const fieldMap = Object.fromEntries((fields ?? []).map((f: TemplateField) => [f.field_key, f]))

  function toggleRequired(field: TemplateField) {
    upsert.mutate({ template_id: templateId, field_key: field.field_key, is_required: !field.is_required, sort_order: field.sort_order })
  }

  function toggleField(key: string) {
    const existing = fieldMap[key]
    if (existing) {
      remove.mutate(existing.id)
    } else {
      const maxOrder = Math.max(0, ...(fields ?? []).map((f: TemplateField) => f.sort_order))
      upsert.mutate({ template_id: templateId, field_key: key as TemplateField['field_key'], is_required: false, sort_order: maxOrder + 1 })
    }
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Fields</h4>
      {(!fields || fields.length === 0) && <EmptyState message="No fields added yet." />}
      {fields && fields.length > 0 && (
        <table className="w-full text-sm mb-3 border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Field</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Required</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f: TemplateField) => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-xs">{f.field_key}</td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={f.is_required} onChange={() => toggleRequired(f)} className="accent-[#c9a465]" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => remove.mutate(f.id)} className="p-1 rounded hover:bg-gray-100 text-red-500"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Add Fields</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_FIELD_KEYS.map(key => {
            const active = !!fieldMap[key]
            return (
              <button
                key={key}
                onClick={() => toggleField(key)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${active ? 'bg-[#c9a465] text-white border-[#c9a465]' : 'border-gray-300 text-gray-600 hover:border-[#c9a465] hover:text-[#c9a465]'}`}
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create MeasurementTemplateEditor**

```tsx
// components/products/measurements/MeasurementTemplateEditor.tsx
'use client'

import { useState } from 'react'
import { useCreateTemplate } from '@/lib/hooks/useMeasurementTemplates'
import MeasurementFieldsTable from './MeasurementFieldsTable'
import type { MeasurementTemplate } from '@/lib/services/measurement-templates'

interface Props {
  template: MeasurementTemplate
}

export default function MeasurementTemplateEditor({ template }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const create = useCreateTemplate()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await create.mutateAsync({ name: newName.trim() })
    setNewName(''); setCreating(false)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-gray-900">{template.name}</p>
          <p className="text-xs text-gray-500">v{template.version} · {template.is_active ? 'Active' : 'Inactive'}</p>
        </div>
        <button
          onClick={() => setCreating(v => !v)}
          className="text-xs text-[#c9a465] border border-[#c9a465] px-2 py-1 rounded hover:bg-[#faf8f5]"
        >
          New version
        </button>
      </div>
      {creating && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New template name"
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
          />
          <button type="submit" disabled={create.isPending} className="px-3 py-1 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">Create</button>
          <button type="button" onClick={() => setCreating(false)} className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
        </form>
      )}
      <MeasurementFieldsTable templateId={template.id} />
    </div>
  )
}
```

- [ ] **Step 3: Create MeasurementTemplateSelector**

```tsx
// components/products/measurements/MeasurementTemplateSelector.tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTemplates, useCreateTemplate } from '@/lib/hooks/useMeasurementTemplates'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import MeasurementTemplateEditor from './MeasurementTemplateEditor'

export default function MeasurementTemplateSelector({ productId }: { productId: string }) {
  const { data: templates, isLoading, error, refetch } = useTemplates({ productId })
  const create = useCreateTemplate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const selected = templates?.find(t => t.id === selectedId) ?? templates?.[0] ?? null

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const t = await create.mutateAsync({ name: newName.trim(), productId })
    setSelectedId(t.id); setShowCreate(false); setNewName('')
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (error) return <ErrorState message="Could not load measurement templates." onRetry={refetch} />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={selectedId ?? selected?.id ?? ''}
          onChange={e => setSelectedId(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
        >
          <option value="">Select a template…</option>
          {templates?.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
        </select>
        <button onClick={() => setShowCreate(v => !v)} className="flex items-center gap-1.5 px-3 py-2 border border-[#c9a465] text-[#c9a465] text-sm rounded hover:bg-[#faf8f5]">
          <Plus size={14} /> New
        </button>
      </div>
      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]" />
          <button type="submit" disabled={create.isPending} className="px-3 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">Create</button>
          <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
        </form>
      )}
      {!selected && templates?.length === 0 && <EmptyState message="No templates yet. Create one to define measurement fields." />}
      {selected && <MeasurementTemplateEditor template={selected} />}
    </div>
  )
}
```

- [ ] **Step 4: Update MeasurementsTab**

```tsx
// components/products/tabs/MeasurementsTab.tsx
'use client';

import MeasurementTemplateSelector from '@/components/products/measurements/MeasurementTemplateSelector'

export default function MeasurementsTab({ productId }: { productId: string }) {
  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Measurements</h2>
      <MeasurementTemplateSelector productId={productId} />
    </div>
  );
}
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/products/measurements/ components/products/tabs/MeasurementsTab.tsx
git commit -m "feat: add Measurement Templates UI and wire MeasurementsTab"
```

---

## Phase E — Blouse Configuration UI

### Task 12: BlouseConfigurationCard + sub-selectors + update CustomizationTab

**Files:**
- Create: `components/products/customization/StitchingOptionsSelector.tsx`
- Create: `components/products/customization/TemplateMappingSelector.tsx`
- Create: `components/products/customization/BlouseConfigurationCard.tsx`

- [ ] **Step 1: Create StitchingOptionsSelector**

```tsx
// components/products/customization/StitchingOptionsSelector.tsx
'use client'

const OPTIONS = ['STITCHED', 'UNSTITCHED'] as const
type StitchingOption = typeof OPTIONS[number]

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export default function StitchingOptionsSelector({ value, onChange }: Props) {
  function toggle(opt: StitchingOption) {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }

  return (
    <div className="flex gap-3">
      {OPTIONS.map(opt => (
        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="accent-[#c9a465]"
          />
          <span>{opt.charAt(0) + opt.slice(1).toLowerCase()}</span>
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create TemplateMappingSelector**

```tsx
// components/products/customization/TemplateMappingSelector.tsx
'use client'

import { useTemplates } from '@/lib/hooks/useMeasurementTemplates'

interface Props {
  value: string | undefined
  onChange: (templateId: string | undefined) => void
}

export default function TemplateMappingSelector({ value, onChange }: Props) {
  const { data: templates, isLoading } = useTemplates()

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || undefined)}
      disabled={isLoading}
      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465] disabled:bg-gray-50"
    >
      <option value="">No measurement template</option>
      {templates?.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
    </select>
  )
}
```

- [ ] **Step 3: Create BlouseConfigurationCard**

```tsx
// components/products/customization/BlouseConfigurationCard.tsx
'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (config) {
      setIncludesBlouse(config.includes_blouse)
      setStitchingOptions(config.stitching_options ?? ['STITCHED', 'UNSTITCHED'])
      setTemplateId(config.blouse_measurement_template_id ?? undefined)
    }
  }, [config])

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

  const label = customizationType
    ? { SEMI_STITCHED: 'Semi Stitched', STANDARD_SIZE: 'Standard Size', CUSTOM_TAILORED: 'Custom Tailored', UNSTITCHED: 'Unstitched' }[customizationType]
    : 'All Types'

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-4">{label}</h4>
      <div className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includesBlouse} onChange={e => setIncludesBlouse(e.target.checked)} className="accent-[#c9a465]" />
          <span className="text-sm font-medium">Includes Blouse</span>
        </label>
        {includesBlouse && (
          <>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Stitching Options</p>
              <StitchingOptionsSelector value={stitchingOptions} onChange={setStitchingOptions} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Blouse Measurement Template</p>
              <TemplateMappingSelector value={templateId} onChange={setTemplateId} />
            </div>
          </>
        )}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={upsert.isPending} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
            {upsert.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {upsert.error && <p className="text-xs text-red-600 text-right">Failed to save.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/products/customization/
git commit -m "feat: add BlouseConfigurationCard, StitchingOptionsSelector, TemplateMappingSelector"
```

---

## Phase F — Size System UI

### Task 13: SizeEntryTable + SizeChartDialog + SizeSystemSelector + update CustomizationTab

**Files:**
- Create: `components/products/sizes/SizeEntryTable.tsx`
- Create: `components/products/sizes/SizeChartDialog.tsx`
- Create: `components/products/sizes/SizeSystemSelector.tsx`
- Modify: `components/products/tabs/CustomizationTab.tsx`

- [ ] **Step 1: Create SizeEntryTable**

```tsx
// components/products/sizes/SizeEntryTable.tsx
'use client'

import { useSizeSystemEntries } from '@/lib/hooks/useSizeSystems'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export default function SizeEntryTable({ systemId }: { systemId: string }) {
  const { data: entries, isLoading } = useSizeSystemEntries(systemId)

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (!entries?.length) return <EmptyState message="No size entries in this system." />

  return (
    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
      <thead className="bg-gray-50">
        <tr>
          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Size</th>
          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Bust (cm)</th>
          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Waist (cm)</th>
          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Hip (cm)</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(entry => (
          <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{entry.label}</td>
            <td className="px-3 py-2 text-right text-gray-600">{entry.bust_cm ?? '—'}</td>
            <td className="px-3 py-2 text-right text-gray-600">{entry.waist_cm ?? '—'}</td>
            <td className="px-3 py-2 text-right text-gray-600">{entry.hip_cm ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Create SizeChartDialog**

```tsx
// components/products/sizes/SizeChartDialog.tsx
'use client'

import { X } from 'lucide-react'
import SizeEntryTable from './SizeEntryTable'
import type { SizeSystem } from '@/lib/services/size-systems'

interface Props {
  system: SizeSystem | null
  onClose: () => void
}

export default function SizeChartDialog({ system, onClose }: Props) {
  if (!system) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{system.name}</h2>
            {system.description && <p className="text-sm text-gray-500">{system.description}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          <SizeEntryTable systemId={system.id} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SizeSystemSelector**

```tsx
// components/products/sizes/SizeSystemSelector.tsx
'use client'

import { useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { useSizeSystems } from '@/lib/hooks/useSizeSystems'
import { Skeleton } from '@/components/ui/skeleton'
import SizeChartDialog from './SizeChartDialog'
import type { SizeSystem } from '@/lib/services/size-systems'

interface Props {
  value: string | undefined
  onChange: (systemId: string | undefined) => void
}

export default function SizeSystemSelector({ value, onChange }: Props) {
  const { data: systems, isLoading } = useSizeSystems()
  const [chartOpen, setChartOpen] = useState(false)

  const selectedSystem: SizeSystem | null = systems?.find(s => s.id === value) ?? null

  if (isLoading) return <Skeleton className="h-10 w-full" />

  return (
    <div className="flex gap-2">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || undefined)}
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
      >
        <option value="">No size system</option>
        {systems?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {selectedSystem && (
        <button
          onClick={() => setChartOpen(true)}
          title="View size chart"
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          <BarChart2 size={14} /> Chart
        </button>
      )}
      <SizeChartDialog system={chartOpen ? selectedSystem : null} onClose={() => setChartOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Update CustomizationTab**

```tsx
// components/products/tabs/CustomizationTab.tsx
'use client';

import { useState } from 'react'
import BlouseConfigurationCard from '@/components/products/customization/BlouseConfigurationCard'
import SizeSystemSelector from '@/components/products/sizes/SizeSystemSelector'

export default function CustomizationTab({ productId }: { productId: string }) {
  const [sizeSystemId, setSizeSystemId] = useState<string | undefined>()

  return (
    <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Customization</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Size System</h3>
            <SizeSystemSelector value={sizeSystemId} onChange={setSizeSystemId} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Blouse Configuration</h3>
            <BlouseConfigurationCard productId={productId} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/products/sizes/ components/products/tabs/CustomizationTab.tsx
git commit -m "feat: add Size System UI and wire CustomizationTab with blouse config"
```

---

## Final Verification

### Task 14: Full build + test run

- [ ] **Step 1: Run all new tests**

```bash
npx vitest run __tests__/components/products/ __tests__/hooks/useBulkCreateVariants.test.ts __tests__/hooks/useTemplateFields.test.ts
```
Expected: all pass

- [ ] **Step 2: Run existing tests to check for regressions**

```bash
npx vitest run __tests__/hooks/useProductColors.test.ts __tests__/hooks/useProductVariants.test.ts __tests__/services/
```
Expected: all pass (same as before)

- [ ] **Step 3: TypeScript full check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Production build**

```bash
npm run build
```
Expected: successful build, 0 errors

- [ ] **Step 5: Final commit if any lint fixes needed**

```bash
npm run lint
git add -A
git commit -m "fix: lint cleanup for variant UI implementation"
```

---

## File Summary

### New files created (21 components + 5 hooks + 7 tests)

```
hooks/
  use-generate-sku.ts
  use-bulk-create-variants.ts
  use-set-primary-media.ts
  use-reorder-media.ts
  use-template-fields.ts

components/products/
  colors/
    ColorFormDialog.tsx
    ColorCard.tsx
    DeleteColorDialog.tsx
    ColorList.tsx
  variants/
    VariantFormDialog.tsx
    VariantInventoryPanel.tsx
    VariantGeneratorDialog.tsx
    VariantTable.tsx
  media/
    MediaCard.tsx
    MediaUploader.tsx
    MediaGrid.tsx
    MediaGallery.tsx
  measurements/
    MeasurementFieldsTable.tsx
    MeasurementTemplateEditor.tsx
    MeasurementTemplateSelector.tsx
  customization/
    StitchingOptionsSelector.tsx
    TemplateMappingSelector.tsx
    BlouseConfigurationCard.tsx
  sizes/
    SizeEntryTable.tsx
    SizeChartDialog.tsx
    SizeSystemSelector.tsx

__tests__/
  components/products/colors/
    ColorFormDialog.test.tsx
    ColorCard.test.tsx
    ColorList.test.tsx
  components/products/variants/
    VariantFormDialog.test.tsx
    VariantTable.test.tsx
  hooks/
    useBulkCreateVariants.test.ts
    useTemplateFields.test.ts
```

### Modified files (4 tab stubs — placeholder body replaced only)

```
components/products/tabs/ColorsVariantsTab.tsx   (~10 lines)
components/products/tabs/MediaGalleryTab.tsx      (~8 lines)
components/products/tabs/CustomizationTab.tsx     (~20 lines)
components/products/tabs/MeasurementsTab.tsx      (~8 lines)
```

### Not touched
All existing hooks, services, layouts, routes, navigation, dashboard, orders, categories, customers, auth — unchanged.
