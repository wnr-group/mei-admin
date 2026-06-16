# Audit Log Viewer + Order/Enquiry Soft-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add soft-delete to orders and enquiries, fix dashboard soft-delete exclusions, and build a read-only audit log viewer with actor names and full filtering.

**Architecture:** A single idempotent migration adds `deleted_at` to `orders`/`enquiries` and missing `audit_logs` indexes. Service functions that mutate orders/enquiries now include a `.is('deleted_at', null)` guard to prevent operating on soft-deleted records. The audit service does a two-step query (logs → profiles) to resolve actor names. A new `/audit` page provides paginated log viewing filtered by action, resource type, and date range. Resource types are derived from the authoritative constant in `lib/audit.ts`.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), Supabase JS client, TanStack Query, Tailwind CSS v4, lucide-react, Vitest

---

## Pre-implementation Facts (verified from codebase)

| Fact | Evidence |
|------|----------|
| `AuditLog` type already exported | `types/index.ts:14` — no change needed |
| `orders.deleted_at` does NOT exist | No migration adds it; remote schema dump (June 11) confirms absence |
| `enquiries.deleted_at` does NOT exist | Same as above |
| `idx_audit_logs_created` already exists | `006_audit_logs.sql` — idempotent `IF NOT EXISTS` |
| `idx_audit_logs_resource` on `(resource_type, resource_id)` already exists | `006_audit_logs.sql` |
| `idx_audit_logs_action` does NOT exist | Not in any migration |
| Dashboard orders query missing `.is('deleted_at', null)` | `dashboard/page.tsx:12` |
| Dashboard enquiries query missing `.is('deleted_at', null)` | `dashboard/page.tsx:13` |
| `useRealtimeOrders` invalidates query cache | Works correctly without change — re-fetch excludes soft-deleted |
| Profiles RLS allows all admins to read `full_name` | `005_rls_policies.sql:33` — `FOR SELECT USING (public.is_admin())` |
| `getAuditLogs` uses browser client with admin session | `createClient()` — admin session passes `is_admin()`, profiles read succeeds; no server-side workaround needed |
| Orders RLS: soft-delete (UPDATE) allowed for all admins | `005_rls_policies.sql` — UPDATE policy uses `is_admin()` |
| Enquiries RLS: all operations allowed for all admins | `005_rls_policies.sql` — `FOR ALL` uses `is_admin()` |
| No frontend role gate on products/categories delete | `products/page.tsx` — no role check; DB RLS handles it |

**Permission model:** Both `admin` and `super_admin` roles can soft-delete orders and enquiries (soft-delete is an UPDATE, and UPDATE is allowed for `is_admin()`). The "super_admin only" RLS in `005_rls_policies.sql` applies to hard-DELETE, not UPDATE. We follow the same no-frontend-role-gate pattern as products/categories.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260616_orders_enquiries_soft_delete.sql` | Add `deleted_at` + missing audit indexes |
| Modify | `types/database.ts` | Add `deleted_at` to orders/enquiries Row and Update types |
| Modify | `lib/audit.ts` | Export `RESOURCE_TYPES` constant |
| Modify | `app/(app)/dashboard/page.tsx` | Exclude soft-deleted records from all three queries |
| Modify | `services/orders.ts` | Add `.is('deleted_at', null)` to `getOrders` + `updateOrderStatus` guard + `deleteOrder()` |
| Create | `__tests__/services/orders.test.ts` | Tests for soft-delete filter and mutation guards |
| Modify | `hooks/use-orders.ts` | Add `useDeleteOrder()` |
| Modify | `app/(app)/orders/page.tsx` | Add disabled delete button per row |
| Modify | `services/enquiries.ts` | Add `.is('deleted_at', null)` to `getEnquiries` + `replyToEnquiry`/`closeEnquiry` guards + `deleteEnquiry()` |
| Create | `__tests__/services/enquiries.test.ts` | Tests for soft-delete filter and mutation guards |
| Modify | `hooks/use-enquiries.ts` | Add `useDeleteEnquiry()` |
| Modify | `app/(app)/enquiries/page.tsx` | Add disabled delete button per row |
| Create | `services/audit-logs.ts` | `getAuditLogs()` with profile join, date normalization, extended filters |
| Create | `__tests__/services/audit-logs.test.ts` | Tests including actor resolution and date normalization |
| Create | `hooks/use-audit-logs.ts` | `useAuditLogs()` query hook |
| Create | `app/(app)/audit/page.tsx` | Read-only audit log viewer (no actor UUID input in UI) |
| Modify | `components/layout/Sidebar.tsx` | Add Audit Log nav item |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260616_orders_enquiries_soft_delete.sql`

- [ ] **Step 1: Verify current column state before proceeding**

Run this in the Supabase SQL editor:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'enquiries')
  AND column_name = 'deleted_at';
```

Expected: 0 rows. If 2 rows are returned the `ALTER TABLE` lines are no-ops. Proceed either way.

- [ ] **Step 2: Create the migration file**

```sql
-- Soft-delete support for orders and enquiries

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial indexes so active-record queries scan only non-deleted rows
CREATE INDEX IF NOT EXISTS idx_orders_not_deleted
  ON public.orders(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_not_deleted
  ON public.enquiries(created_at DESC)
  WHERE deleted_at IS NULL;

-- Audit log query indexes (idx_audit_logs_created and idx_audit_logs_resource
-- already exist from 006_audit_logs.sql; only the action index is new)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action);

-- Idempotent re-declarations of existing indexes (safe no-ops if present)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type
  ON public.audit_logs(resource_type);
```

- [ ] **Step 3: Apply the migration**

Run: `npx supabase db push`
Expected: No errors. Orders and enquiries now have `deleted_at TIMESTAMPTZ`. Audit log indexes present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260616_orders_enquiries_soft_delete.sql
git commit -m "feat: add deleted_at to orders/enquiries and missing audit_logs indexes"
```

---

## Task 2: Update TypeScript Database Types

**Files:**
- Modify: `types/database.ts`

Note: `AuditLog` is already exported from `types/index.ts:14`. No change needed there.

- [ ] **Step 1: Add deleted_at to the orders Row and Update types**

In `types/database.ts`, find the `orders:` block (Row line starts with `id: string; order_number: string;`) and replace:

```typescript
      orders: {
        Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null }
      }
```

with:

```typescript
      orders: {
        Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null; deleted_at?: string | null }
      }
```

- [ ] **Step 2: Add deleted_at to the enquiries Row and Update types**

In `types/database.ts`, find the `enquiries:` block (Row line starts with `id: string; name: string; email: string;`) and replace:

```typescript
      enquiries: {
        Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string }
        Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null }
      }
```

with:

```typescript
      enquiries: {
        Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null; deleted_at?: string | null }
      }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors. (`Order` and `Enquiry` are aliases for these Row types — they gain `deleted_at` automatically.)

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "feat: add deleted_at to orders and enquiries TypeScript types"
```

---

## Task 3: lib/audit.ts — Export RESOURCE_TYPES

**Files:**
- Modify: `lib/audit.ts`

- [ ] **Step 1: Export RESOURCE_TYPES constant**

Replace `lib/audit.ts` entirely:

```typescript
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

type ResourceType =
  | 'product'
  | 'category'
  | 'order'
  | 'enquiry'
  | 'banner'
  | 'setting'
  | 'profile'

export const RESOURCE_TYPES = [
  'product',
  'category',
  'order',
  'enquiry',
  'banner',
  'setting',
  'profile',
] as const

interface AuditParams {
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string
  oldData?: Json
  newData?: Json
}

export async function logAuditEvent(params: AuditParams) {
  try {
    const supabase = createClient()

    let user: { id: string } | null = null

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      user = authUser
    } catch {
      return
    }

    if (!user) return

    const insertData = {
      admin_id: user.id,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
    }

    await supabase.from('audit_logs').insert([insertData] as never)
  } catch {
    // Silently fail — audit logging must never break the main operation
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/audit.ts
git commit -m "feat: export RESOURCE_TYPES constant from lib/audit.ts"
```

---

## Task 4: Dashboard — Exclude Soft-Deleted Records

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add deleted_at filters to the orders and enquiries queries**

In `app/(app)/dashboard/page.tsx`, replace the `Promise.all` block (lines 10–14):

```typescript
  const [productsResult, ordersResult, enquiriesResult] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }).eq('status', 'NEW')
  ])
```

with:

```typescript
  const [productsResult, ordersResult, enquiriesResult] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'NEW')
  ])
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/dashboard/page.tsx"
git commit -m "fix: exclude soft-deleted orders and enquiries from dashboard counts"
```

---

## Task 5: Orders — Soft-Delete Service + Tests

**Files:**
- Modify: `services/orders.ts`
- Create: `__tests__/services/orders.test.ts`

`updateOrderStatus` gains a `.is('deleted_at', null)` guard so that calling it on a soft-deleted order fails safely at the DB level rather than silently succeeding.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/services/orders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getOrders, updateOrderStatus, deleteOrder } = await import('@/services/orders')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

function createMockChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'order', 'range', 'single']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('getOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters out soft-deleted orders', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getOrders()
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns orders and total count', async () => {
    createMockChain({ data: [{ id: '1', order_number: '#ORD-9000', total: 5000 }], count: 1, error: null })
    const result = await getOrders()
    expect(result.orders).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('filters by status', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getOrders({ status: 'PENDING' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'PENDING')
  })

  it('applies pagination', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getOrders({ page: 2, limit: 10 })
    expect(chain.range).toHaveBeenCalledWith(10, 19)
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, count: null, error: { message: 'DB error' } })
    await expect(getOrders()).rejects.toThrow('DB error')
  })
})

describe('updateOrderStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies deleted_at IS NULL guard to prevent updating soft-deleted orders', async () => {
    const chain = createMockChain({ data: { id: '1', status: 'CONFIRMED' }, error: null })
    await updateOrderStatus('1', 'CONFIRMED')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('throws when order is soft-deleted or not found', async () => {
    createMockChain({ data: null, error: { message: 'Row not found' } })
    await expect(updateOrderStatus('deleted-id', 'CONFIRMED')).rejects.toThrow('Row not found')
  })
})

describe('deleteOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft deletes order by setting deleted_at', async () => {
    const chain = createMockChain({ error: null })
    await deleteOrder('order-1')
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', 'order-1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteOrder('order-1')).rejects.toThrow('Delete failed')
  })

  it('does not access audit_logs when DB update fails', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteOrder('order-1')).rejects.toThrow('Delete failed')
    expect(mockFrom).not.toHaveBeenCalledWith('audit_logs')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run __tests__/services/orders.test.ts`
Expected: FAIL — `deleteOrder` not exported; `getOrders` soft-delete filter test fails; `updateOrderStatus` guard test fails.

- [ ] **Step 3: Update services/orders.ts**

Replace `services/orders.ts` entirely:

```typescript
import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { Order, OrderStatus } from '@/types'

interface GetOrdersOptions {
  page?: number
  limit?: number
  status?: OrderStatus
}

export async function getOrders(options: GetOrdersOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, status } = options

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) throw toAppError(new Error(error.message))
  return { orders: (data as Order[] | null) ?? [], total: count ?? 0 }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = createClient()
  const response = await supabase
    .from('orders')
    .update({ status } as never)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  const { data, error } = response as { data: Order | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'order',
    resourceId: id,
    newData: { status },
  })

  return data as Order
}

export async function deleteOrder(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  // Only reached on success — failure path throws above
  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'order',
    resourceId: id,
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run __tests__/services/orders.test.ts`
Expected: All 10 tests PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add services/orders.ts __tests__/services/orders.test.ts
git commit -m "feat: add deleteOrder, soft-delete filter in getOrders, and deleted_at guard in updateOrderStatus"
```

---

## Task 6: Orders — Delete Hook + UI

**Files:**
- Modify: `hooks/use-orders.ts`
- Modify: `app/(app)/orders/page.tsx`

- [ ] **Step 1: Add useDeleteOrder to hooks/use-orders.ts**

Replace `hooks/use-orders.ts` entirely:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateOrderStatus, deleteOrder } from '@/services/orders'
import type { OrderStatus } from '@/types'

type GetOrdersOptions = Parameters<typeof getOrders>[0]

export function useOrders(options?: GetOrdersOptions) {
  return useQuery({
    queryKey: ['orders', options],
    queryFn: () => getOrders(options),
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
```

- [ ] **Step 2: Wire the delete button into app/(app)/orders/page.tsx**

Make four targeted changes:

**a) Update the import** — add `useDeleteOrder`:
```typescript
import { useOrders, useUpdateOrderStatus, useDeleteOrder } from '@/hooks/use-orders'
```

**b) Add the mutation** — immediately after `useUpdateOrderStatus()`, before `useRealtimeOrders()`:
```typescript
const deleteOrderMutation = useDeleteOrder()
```

**c) Add the handler** — after `handleStatusChange`, before `if (orders.length === 0)`:
```typescript
const handleDelete = async (id: string, orderNumber: string) => {
  if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return
  try {
    await deleteOrderMutation.mutateAsync(id)
  } catch {
    alert('Failed to delete order')
  }
}
```

**d) Replace the loading overlay** — the existing `{updateOrderStatusMutation.isPending && ...}` block:
```tsx
{(updateOrderStatusMutation.isPending || deleteOrderMutation.isPending) && (
  <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
    <div className="text-zinc-500 font-medium text-xs">
      {deleteOrderMutation.isPending ? 'Deleting order...' : 'Updating order...'}
    </div>
  </div>
)}
```

**e) Add DELETE button** — the ACTIONS cell (~line 154) currently has only VIEW; replace the full `<td>`. The DELETE button is disabled while any delete mutation is pending to prevent duplicate submissions:
```tsx
<td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
  <button className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors">
    VIEW
  </button>
  <button
    onClick={() => handleDelete(order.id, order.order_number)}
    disabled={deleteOrderMutation.isPending}
    className={`uppercase transition-colors ${
      deleteOrderMutation.isPending
        ? 'text-zinc-300 cursor-not-allowed'
        : 'text-red-400 hover:text-red-600'
    }`}
  >
    DELETE
  </button>
</td>
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-orders.ts "app/(app)/orders/page.tsx"
git commit -m "feat: add delete button to orders page with disabled state during mutation"
```

---

## Task 7: Enquiries — Soft-Delete Service + Tests

**Files:**
- Modify: `services/enquiries.ts`
- Create: `__tests__/services/enquiries.test.ts`

`replyToEnquiry` and `closeEnquiry` each gain a `.is('deleted_at', null)` guard. The test file mocks `auth.getUser()` to allow testing these functions.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/services/enquiries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'test-admin-id' } } })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom, auth: { getUser: mockGetUser } }),
}))

const { getEnquiries, replyToEnquiry, closeEnquiry, deleteEnquiry } = await import('@/services/enquiries')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

function createMockChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'order', 'range', 'single']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('getEnquiries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters out soft-deleted enquiries', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getEnquiries()
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns enquiries and total count', async () => {
    createMockChain({ data: [{ id: '1', name: 'Alice', email: 'a@b.com', message: 'Hi' }], count: 1, error: null })
    const result = await getEnquiries()
    expect(result.enquiries).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('filters by status', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getEnquiries({ status: 'NEW' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'NEW')
  })

  it('applies pagination', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getEnquiries({ page: 3, limit: 5 })
    expect(chain.range).toHaveBeenCalledWith(10, 14)
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, count: null, error: { message: 'DB error' } })
    await expect(getEnquiries()).rejects.toThrow('DB error')
  })
})

describe('replyToEnquiry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies deleted_at IS NULL guard to prevent replying to soft-deleted enquiries', async () => {
    const chain = createMockChain({ data: { id: '1', status: 'REPLIED' }, error: null })
    await replyToEnquiry('1', 'Hello')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('throws when enquiry is soft-deleted or not found', async () => {
    createMockChain({ data: null, error: { message: 'Row not found' } })
    await expect(replyToEnquiry('deleted-id', 'Hello')).rejects.toThrow('Row not found')
  })
})

describe('closeEnquiry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies deleted_at IS NULL guard to prevent closing soft-deleted enquiries', async () => {
    const chain = createMockChain({ data: { id: '1', status: 'CLOSED' }, error: null })
    await closeEnquiry('1')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('throws when enquiry is soft-deleted or not found', async () => {
    createMockChain({ data: null, error: { message: 'Row not found' } })
    await expect(closeEnquiry('deleted-id')).rejects.toThrow('Row not found')
  })
})

describe('deleteEnquiry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft deletes enquiry by setting deleted_at', async () => {
    const chain = createMockChain({ error: null })
    await deleteEnquiry('enquiry-1')
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', 'enquiry-1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteEnquiry('enquiry-1')).rejects.toThrow('Delete failed')
  })

  it('does not access audit_logs when DB update fails', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteEnquiry('enquiry-1')).rejects.toThrow('Delete failed')
    expect(mockFrom).not.toHaveBeenCalledWith('audit_logs')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run __tests__/services/enquiries.test.ts`
Expected: FAIL — `deleteEnquiry` not exported; `getEnquiries` filter test fails; `replyToEnquiry`/`closeEnquiry` guard tests fail.

- [ ] **Step 3: Update services/enquiries.ts**

Replace `services/enquiries.ts` entirely:

```typescript
import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { Enquiry, EnquiryStatus } from '@/types'
import type { Json } from '@/types/database'

interface GetEnquiriesOptions {
  page?: number
  limit?: number
  status?: EnquiryStatus
}

export async function getEnquiries(options: GetEnquiriesOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, status } = options

  let query = supabase
    .from('enquiries')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) throw toAppError(new Error(error.message))
  return { enquiries: (data as Enquiry[] | null) ?? [], total: count ?? 0 }
}

export async function replyToEnquiry(id: string, adminReply: string) {
  const supabase = createClient()
  const response = await supabase
    .from('enquiries')
    .update({
      admin_reply: adminReply,
      status: 'REPLIED',
      replied_at: new Date().toISOString(),
      replied_by: (await supabase.auth.getUser()).data.user?.id ?? null
    } as never)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  const { data, error } = response as { data: Enquiry | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'enquiry',
    resourceId: id,
    newData: { admin_reply: adminReply, status: 'REPLIED' } as Json,
  })

  return data as Enquiry
}

export async function closeEnquiry(id: string) {
  const supabase = createClient()
  const response = await supabase
    .from('enquiries')
    .update({ status: 'CLOSED' } as never)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  const { data, error } = response as { data: Enquiry | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'enquiry',
    resourceId: id,
    newData: { status: 'CLOSED' } as Json,
  })

  return data as Enquiry
}

export async function deleteEnquiry(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('enquiries')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  // Only reached on success — failure path throws above
  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'enquiry',
    resourceId: id,
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run __tests__/services/enquiries.test.ts`
Expected: All 12 tests PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add services/enquiries.ts __tests__/services/enquiries.test.ts
git commit -m "feat: add deleteEnquiry, soft-delete filter, and deleted_at guards in replyToEnquiry/closeEnquiry"
```

---

## Task 8: Enquiries — Delete Hook + UI

**Files:**
- Modify: `hooks/use-enquiries.ts`
- Modify: `app/(app)/enquiries/page.tsx`

- [ ] **Step 1: Add useDeleteEnquiry to hooks/use-enquiries.ts**

Replace `hooks/use-enquiries.ts` entirely:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEnquiries, replyToEnquiry, closeEnquiry, deleteEnquiry } from '@/services/enquiries'

type GetEnquiriesOptions = Parameters<typeof getEnquiries>[0]

export function useEnquiries(options?: GetEnquiriesOptions) {
  return useQuery({
    queryKey: ['enquiries', options],
    queryFn: () => getEnquiries(options),
  })
}

export function useReplyToEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      replyToEnquiry(id, reply),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  })
}

export function useCloseEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => closeEnquiry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  })
}

export function useDeleteEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEnquiry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  })
}
```

- [ ] **Step 2: Wire the delete button into app/(app)/enquiries/page.tsx**

Make four targeted changes:

**a) Update the import** — add `useDeleteEnquiry`:
```typescript
import { useEnquiries, useReplyToEnquiry, useCloseEnquiry, useDeleteEnquiry } from '@/hooks/use-enquiries'
```

**b) Add the mutation** — after `closeMutation`:
```typescript
const deleteEnquiryMutation = useDeleteEnquiry()
```

**c) Add the handler** — after `handleClose`, before `if (enquiries.length === 0)`:
```typescript
const handleDelete = async (id: string, name: string) => {
  if (!confirm(`Delete enquiry from ${name}? This cannot be undone.`)) return
  try {
    await deleteEnquiryMutation.mutateAsync(id)
    if (selectedEnquiry?.id === id) setSelectedEnquiry(null)
  } catch {
    alert('Failed to delete enquiry')
  }
}
```

**d) Replace the loading overlay** — the existing `{(replyMutation.isPending || closeMutation.isPending) && ...}` block:
```tsx
{(replyMutation.isPending || closeMutation.isPending || deleteEnquiryMutation.isPending) && (
  <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
    <div className="text-zinc-500 font-medium text-xs">
      {deleteEnquiryMutation.isPending ? 'Deleting enquiry...' : 'Processing...'}
    </div>
  </div>
)}
```

**e) Add DELETE button** — ACTIONS cell (~line 157) currently has only REPLY/VIEW; replace the full `<td>`. The DELETE button is disabled while any delete mutation is pending:
```tsx
<td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
  <button
    onClick={() => {
      setSelectedEnquiry(enquiry)
      setReplyText(enquiry.admin_reply ?? '')
    }}
    className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
  >
    {enquiry.status === 'NEW' ? 'REPLY' : 'VIEW'}
  </button>
  <button
    onClick={() => handleDelete(enquiry.id, enquiry.name)}
    disabled={deleteEnquiryMutation.isPending}
    className={`uppercase transition-colors ${
      deleteEnquiryMutation.isPending
        ? 'text-zinc-300 cursor-not-allowed'
        : 'text-red-400 hover:text-red-600'
    }`}
  >
    DELETE
  </button>
</td>
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-enquiries.ts "app/(app)/enquiries/page.tsx"
git commit -m "feat: add delete button to enquiries page with disabled state during mutation"
```

---

## Task 9: Audit Logs — Service + Tests

**Files:**
- Create: `services/audit-logs.ts`
- Create: `__tests__/services/audit-logs.test.ts`

The service resolves actor names by batch-fetching profiles after the log query. Date inputs from `<input type="date">` (`"YYYY-MM-DD"`) are normalized to full ISO timestamps before the query to avoid excluding same-day records. `adminId` filtering is kept in the service layer but is NOT exposed in the UI.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/services/audit-logs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getAuditLogs } = await import('@/services/audit-logs')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

// Does NOT auto-wire mockFrom — use mockReturnValueOnce at the call site
function createChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'range']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)
  return chain
}

const sampleLog = { id: '1', action: 'CREATE', resource_type: 'product', resource_id: 'p1', admin_id: 'a1', created_at: '2026-06-16T10:00:00Z', old_data: null, new_data: null, user_agent: null, session_id: null }

describe('getAuditLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches from audit_logs table', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: [], count: 0, error: null }))
    await getAuditLogs()
    expect(mockFrom).toHaveBeenCalledWith('audit_logs')
  })

  it('returns logs and total count', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: [sampleLog], count: 1, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'a1', full_name: 'Alice Admin' }], error: null }))
    const result = await getAuditLogs()
    expect(result.logs).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('resolves actor name from profiles', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: [sampleLog], count: 1, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'a1', full_name: 'Alice Admin' }], error: null }))
    const result = await getAuditLogs()
    expect(result.logs[0].actor_name).toBe('Alice Admin')
  })

  it('falls back to "Admin" when profile full_name is null', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: [sampleLog], count: 1, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'a1', full_name: null }], error: null }))
    const result = await getAuditLogs()
    expect(result.logs[0].actor_name).toBe('Admin')
  })

  it('falls back to "System" when admin_id is null', async () => {
    const systemLog = { ...sampleLog, admin_id: null }
    mockFrom.mockReturnValueOnce(createChain({ data: [systemLog], count: 1, error: null }))
    const result = await getAuditLogs()
    expect(result.logs[0].actor_name).toBe('System')
  })

  it('applies pagination', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ page: 3, limit: 10 })
    expect(chain.range).toHaveBeenCalledWith(20, 29)
  })

  it('filters by action', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ action: 'DELETE' })
    expect(chain.eq).toHaveBeenCalledWith('action', 'DELETE')
  })

  it('filters by resourceType', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ resourceType: 'order' })
    expect(chain.eq).toHaveBeenCalledWith('resource_type', 'order')
  })

  it('filters by adminId', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ adminId: 'admin-uuid-1' })
    expect(chain.eq).toHaveBeenCalledWith('admin_id', 'admin-uuid-1')
  })

  it('normalizes dateFrom to start of day (T00:00:00.000Z)', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ dateFrom: '2026-06-01' })
    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-06-01T00:00:00.000Z')
  })

  it('normalizes dateTo to end of day (T23:59:59.999Z)', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ dateTo: '2026-06-30' })
    expect(chain.lte).toHaveBeenCalledWith('created_at', '2026-06-30T23:59:59.999Z')
  })

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, count: null, error: { message: 'Access denied' } }))
    await expect(getAuditLogs()).rejects.toThrow('Access denied')
  })

  it('returns empty logs when no data', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, count: null, error: null }))
    const result = await getAuditLogs()
    expect(result.logs).toEqual([])
    expect(result.total).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run __tests__/services/audit-logs.test.ts`
Expected: FAIL — `Cannot find module '@/services/audit-logs'`.

- [ ] **Step 3: Create services/audit-logs.ts**

```typescript
import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import type { AuditLog } from '@/types'

export type AuditLogWithActor = AuditLog & { actor_name: string }

interface GetAuditLogsOptions {
  page?: number
  limit?: number
  action?: 'CREATE' | 'UPDATE' | 'DELETE'
  resourceType?: string
  adminId?: string
  dateFrom?: string  // YYYY-MM-DD — normalized to T00:00:00.000Z internally
  dateTo?: string    // YYYY-MM-DD — normalized to T23:59:59.999Z internally
}

export async function getAuditLogs(options: GetAuditLogsOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, action, resourceType, adminId, dateFrom, dateTo } = options

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (action) query = query.eq('action', action)
  if (resourceType) query = query.eq('resource_type', resourceType)
  if (adminId) query = query.eq('admin_id', adminId)
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)

  const { data, error, count } = await query
  if (error) throw toAppError(new Error(error.message))

  const logs = (data as AuditLog[] | null) ?? []

  // Batch-fetch profiles to resolve actor names (profiles RLS allows all admins to read)
  const adminIds = [...new Set(logs.map(l => l.admin_id).filter(Boolean))] as string[]
  const profileMap: Record<string, string | null> = {}
  if (adminIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', adminIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = p.full_name
    }
  }

  const logsWithActor: AuditLogWithActor[] = logs.map(log => ({
    ...log,
    actor_name: log.admin_id
      ? (profileMap[log.admin_id] ?? 'Admin')
      : 'System',
  }))

  return { logs: logsWithActor, total: count ?? 0 }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run __tests__/services/audit-logs.test.ts`
Expected: All 13 tests PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add services/audit-logs.ts __tests__/services/audit-logs.test.ts
git commit -m "feat: add getAuditLogs with actor resolution, date normalization, and extended filtering"
```

---

## Task 10: Audit Logs — Hook, Page, and Sidebar

**Files:**
- Create: `hooks/use-audit-logs.ts`
- Create: `app/(app)/audit/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

The UI exposes action tabs, resource-type select, and date range inputs. The actor UUID filter is intentionally omitted from the UI (it remains in the service layer for programmatic use).

- [ ] **Step 1: Create hooks/use-audit-logs.ts**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { getAuditLogs } from '@/services/audit-logs'

type GetAuditLogsOptions = Parameters<typeof getAuditLogs>[0]

export function useAuditLogs(options?: GetAuditLogsOptions) {
  return useQuery({
    queryKey: ['audit-logs', options],
    queryFn: () => getAuditLogs(options),
  })
}
```

- [ ] **Step 2: Create app/(app)/audit/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useAuditLogs } from '@/hooks/use-audit-logs'
import { RESOURCE_TYPES } from '@/lib/audit'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'

type ActionFilter = 'CREATE' | 'UPDATE' | 'DELETE'
const ACTION_TABS: ActionFilter[] = ['CREATE', 'UPDATE', 'DELETE']

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [selectedAction, setSelectedAction] = useState<ActionFilter | null>(null)
  const [selectedResourceType, setSelectedResourceType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading, error, refetch } = useAuditLogs({
    page,
    limit: 20,
    action: selectedAction ?? undefined,
    resourceType: selectedResourceType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const itemsPerPage = 20
  const totalPages = Math.ceil(total / itemsPerPage)

  const resetFilters = () => {
    setSelectedAction(null)
    setSelectedResourceType('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  if (isLoading) return <TableSkeleton rows={8} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Audit Log
        </h3>
        <button
          onClick={resetFilters}
          className="text-[10px] font-bold tracking-widest text-zinc-400 hover:text-zinc-600 uppercase transition-colors"
        >
          RESET FILTERS
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">

        {/* Row 1: Action tabs + Resource type select */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedAction(null); setPage(1) }}
              className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
                selectedAction === null
                  ? 'bg-[#B38B5D] text-white'
                  : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              ALL ACTIONS
            </button>
            {ACTION_TABS.map((action) => (
              <button
                key={action}
                onClick={() => { setSelectedAction(action); setPage(1) }}
                className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
                  selectedAction === action
                    ? 'bg-[#B38B5D] text-white'
                    : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {action}
              </button>
            ))}
          </div>

          <select
            value={selectedResourceType}
            onChange={(e) => { setSelectedResourceType(e.target.value); setPage(1) }}
            className="border border-[#E8E0D5] bg-white px-3 py-2 text-[11px] font-bold text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
          >
            <option value="">ALL RESOURCES</option>
            {RESOURCE_TYPES.map((rt) => (
              <option key={rt} value={rt}>{rt.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Row 2: Date range */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">FROM</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="border border-[#E8E0D5] bg-white px-3 py-2 text-[11px] text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">TO</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="border border-[#E8E0D5] bg-white px-3 py-2 text-[11px] text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState message="No audit log entries found." />
      ) : (
        <div className="bg-white border border-[#E8E0D5] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[22%]">
                    TIMESTAMP
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[13%]">
                    ACTION
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                    RESOURCE TYPE
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                    RESOURCE ID
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                    ACTOR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-[7.5px] font-bold tracking-widest rounded-none uppercase ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-800'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium uppercase">
                      {log.resource_type}
                    </td>
                    <td className="px-6 py-3 text-[11px] text-zinc-500 font-mono">
                      {log.resource_id ? `${log.resource_id.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                      {log.actor_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 border-t border-[#E8E0D5] gap-4 bg-[#FAF8F5]/30">
            <span className="text-[10px] font-medium text-zinc-400 tracking-wide">
              Showing {total === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, total)} of {total} entries
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                    page === 1 ? 'text-zinc-300 border-zinc-100 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  PREV
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-[9px] font-bold transition-all duration-150 ${
                      page === p
                        ? 'bg-[#B38B5D] text-white'
                        : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                    page === totalPages ? 'text-zinc-300 border-zinc-100 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  NEXT
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add Audit Log nav item to Sidebar.tsx**

**a) Add `ScrollText` to the lucide-react import:**

Replace:
```typescript
import {
  LayoutDashboard,
  ShoppingBag,
  Layers,
  ShoppingCart,
  Mail,
  Image as ImageIcon,
  Settings,
  LogOut
} from 'lucide-react';
```

with:
```typescript
import {
  LayoutDashboard,
  ShoppingBag,
  Layers,
  ShoppingCart,
  Mail,
  Image as ImageIcon,
  Settings,
  LogOut,
  ScrollText,
} from 'lucide-react';
```

**b) Append the audit nav item to `navItems`:**

Replace:
```typescript
const navItems = [
  { href: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { href: '/products', label: 'PRODUCTS', icon: ShoppingBag },
  { href: '/categories', label: 'CATEGORIES', icon: Layers },
  { href: '/orders', label: 'ORDERS', icon: ShoppingCart },
  { href: '/enquiries', label: 'ENQUIRIES', icon: Mail },
  { href: '/banners', label: 'BANNERS', icon: ImageIcon },
  { href: '/settings', label: 'SETTINGS', icon: Settings },
];
```

with:
```typescript
const navItems = [
  { href: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { href: '/products', label: 'PRODUCTS', icon: ShoppingBag },
  { href: '/categories', label: 'CATEGORIES', icon: Layers },
  { href: '/orders', label: 'ORDERS', icon: ShoppingCart },
  { href: '/enquiries', label: 'ENQUIRIES', icon: Mail },
  { href: '/banners', label: 'BANNERS', icon: ImageIcon },
  { href: '/settings', label: 'SETTINGS', icon: Settings },
  { href: '/audit', label: 'AUDIT LOG', icon: ScrollText },
];
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass — new orders (10), enquiries (12), audit-logs (13) tests plus all pre-existing tests.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 6: Final commit**

```bash
git add hooks/use-audit-logs.ts "app/(app)/audit/page.tsx" components/layout/Sidebar.tsx
git commit -m "feat: add audit log viewer with actor names, date range, and resource type filters"
```

---

## Regression Checklist

Run `npm run dev` and verify each item manually after all tasks complete.

### Orders page
- [ ] Existing orders appear as before
- [ ] DELETE button is visible per row
- [ ] Clicking DELETE shows: "Delete order #ORD-XXXX? This cannot be undone."
- [ ] Dismissing the dialog leaves the order untouched
- [ ] Confirming DELETE immediately removes the order from the list (cache invalidation)
- [ ] All DELETE buttons are `disabled` and visually greyed while a delete is in flight (no double-click)
- [ ] After deleting, open Supabase table editor: verify `deleted_at` is populated for that row
- [ ] Refresh the page: soft-deleted order does NOT reappear
- [ ] Attempting to change status on an order via the status select still works for non-deleted orders

### Enquiries page
- [ ] Existing enquiries appear as before
- [ ] DELETE button is visible per row alongside REPLY/VIEW
- [ ] All DELETE buttons are `disabled` and greyed while a delete is in flight
- [ ] Confirming DELETE removes the enquiry from the list
- [ ] If the deleted enquiry was open in the side panel, the panel closes
- [ ] After deleting, verify `deleted_at` is populated in Supabase
- [ ] Refresh the page: soft-deleted enquiry does NOT reappear
- [ ] REPLY and CLOSE still work on non-deleted enquiries

### Dashboard counts
- [ ] TOTAL ORDERS count excludes soft-deleted orders — soft-delete one order, refresh dashboard, count decreases by 1
- [ ] NEW ENQUIRIES count excludes soft-deleted enquiries — soft-delete a NEW enquiry, refresh dashboard, count decreases by 1
- [ ] Recent Orders widget excludes soft-deleted orders
- [ ] TOTAL PRODUCTS still correct (was already filtering)

### Audit viewer (`/audit`)
- [ ] Page loads; existing log entries appear
- [ ] ACTOR column shows full name (e.g., "Eshwar Paygude") for entries where the profile has `full_name` set
- [ ] ACTOR column shows "Admin" for entries where profile `full_name` is null
- [ ] ACTOR column shows "System" for any entry where `admin_id` is null
- [ ] After soft-deleting an order, navigate to /audit: a DELETE entry for resource_type "order" appears at the top
- [ ] After soft-deleting an enquiry, navigate to /audit: a DELETE entry for resource_type "enquiry" appears at the top
- [ ] Action filter CREATE/UPDATE/DELETE narrows results correctly
- [ ] Resource type filter "order" shows only order-related entries
- [ ] Date FROM filter excludes entries before the chosen date (same-day records are included)
- [ ] Date TO filter excludes entries after the chosen date (same-day records are included)
- [ ] RESET FILTERS clears all filters and reloads all entries
- [ ] Pagination PREV/NEXT and page numbers navigate correctly

### Sidebar
- [ ] "AUDIT LOG" nav item appears below SETTINGS with the ScrollText icon
- [ ] Gold left-border active state shows when on /audit

### Realtime orders
- [ ] Soft-deleting an order on one browser tab causes it to disappear from the orders list on a second open tab (realtime invalidation re-fetches with `deleted_at IS NULL` filter)

### Role-based permissions
- [ ] Both `admin` and `super_admin` role accounts see the DELETE button on orders and enquiries
- [ ] Soft-delete succeeds for both roles (UPDATE allowed for all admins per RLS)
