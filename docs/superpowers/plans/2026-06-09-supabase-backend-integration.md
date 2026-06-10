# MEI Bridal Couture Admin — Supabase Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage/mock data with full Supabase backend — PostgreSQL database, Supabase Auth for admin sessions, and Supabase Storage for product images — across all admin modules.

**Architecture:** Next.js 16 App Router with Server Components for data fetching, `@supabase/ssr` for cookie-based session management, and TanStack Query v5 for client-side cache and optimistic updates. Row-level security at the database level enforces admin-only access. SQL migrations via Supabase CLI.

**Tech Stack:** Next.js 16 App Router, Supabase JS v2, @supabase/ssr, TanStack Query v5, Vitest, TypeScript strict

---

> **Scope Note:** This plan covers 7 subsystems sharing common infrastructure. Phases can be executed independently:
> - **Phase 1 (Tasks 1–7):** Foundation — deps, env, Supabase clients, auth
> - **Phase 2 (Tasks 8–14):** Database schema, RLS, TypeScript types
> - **Phase 3 (Tasks 15–27):** All module integrations
> - **Phase 4 (Tasks 28–29):** Real-time + cleanup

---

## File Map

```
New files:
middleware.ts
.env.example
vitest.config.ts
vitest.setup.ts
supabase/migrations/
  001_profiles_roles.sql
  002_categories_products.sql
  003_customers_orders.sql
  004_enquiries_banners_settings.sql
  005_rls_policies.sql
  006_audit_logs.sql
supabase/seed.sql
lib/supabase/
  server.ts
  client.ts
types/
  database.ts
  index.ts
services/
  auth.ts
  products.ts
  categories.ts
  orders.ts
  enquiries.ts
  banners.ts
  settings.ts
  storage.ts
hooks/
  use-products.ts
  use-categories.ts
  use-orders.ts
  use-enquiries.ts
  use-banners.ts
  use-settings.ts
  use-realtime-orders.ts
providers/
  query-provider.tsx
components/ui/
  skeleton.tsx
  error-state.tsx
  empty-state.tsx
__tests__/services/
  auth.test.ts
  products.test.ts
app/(app)/
  categories/page.tsx
  orders/page.tsx
  enquiries/page.tsx
  banners/page.tsx
  settings/page.tsx

Modified:
package.json                   (new scripts + deps)
app/layout.tsx                 (add QueryProvider)
app/login/page.tsx             (wire Supabase Auth)
components/layout/Sidebar.tsx  (wire sign out)
app/(app)/dashboard/page.tsx   (real DB stats via Server Component)
app/(app)/products/page.tsx    (replace mockDb with hooks)
lib/mockDb.ts                  (DELETE this file in Task 29)
```

---

### Task 1: Install Dependencies + Test Setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Check Next.js 16 docs for breaking changes**

```bash
ls node_modules/next/dist/docs/ 2>/dev/null | head -20
```

Look for changes to `cookies()`, `headers()`, middleware matcher syntax. The `cookies()` from `next/headers` must be awaited in Next.js 15+.

- [ ] **Step 2: Install production dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query
```

Expected: packages added with no peer dependency errors.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom @tanstack/react-query-devtools
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test scripts to `package.json`**

In the `"scripts"` section add:
```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 7: Verify install works**

```bash
npm run test:run
```

Expected: "No test files found, exiting with code 0" — no failures.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "feat: install Supabase, TanStack Query, Vitest"
```

---

### Task 2: Environment Variables

**Files:**
- Create: `.env.example`
- Create: `.env.local` (manually — not committed)
- Verify: `.gitignore`

- [ ] **Step 1: Confirm `.gitignore` has `.env.local`**

Open `.gitignore`. If `.env.local` is missing, add it.

- [ ] **Step 2: Create `.env.example`**

```bash
# Supabase project (get from: Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Service role key — server-side only, NEVER expose to browser
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 3: Create `.env.local` with real credentials**

Go to: Supabase Dashboard → Project Settings → API. Copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **`anon` `public` key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **`service_role` key** → `SUPABASE_SERVICE_ROLE_KEY`

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 4: Commit only the example file**

```bash
git add .env.example
git commit -m "chore: add env variable template for Supabase"
```

---

### Task 3: Supabase Client Utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `types/database.ts` (placeholder)

- [ ] **Step 1: Create placeholder `types/database.ts`**

This will be replaced with the full schema in Task 14. It is needed now to avoid import errors.

```typescript
// Replaced with generated types in Task 14
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
```

- [ ] **Step 2: Create browser client `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create server client `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Server Components cookie writes are ignored;
            // the middleware handles session refresh.
          }
        },
      },
    }
  )
}
```

**Note on Next.js 16:** `cookies()` must be awaited (added `await` above). If you get a type error, check `node_modules/next/dist/docs/` for the exact signature in this version.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/ types/database.ts
git commit -m "feat: add Supabase server and browser client utilities"
```

---

### Task 4: Next.js Middleware (Route Protection)

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts` at project root**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Test redirect in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: redirected to `/login`.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect admin routes with Supabase session middleware"
```

---

### Task 5: Auth Service + Tests

**Files:**
- Create: `services/auth.ts`
- Create: `__tests__/services/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/services/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignIn = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
  }),
}))

const { signIn, signOut } = await import('@/services/auth')

describe('signIn', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user on success', async () => {
    const mockUser = { id: 'u1', email: 'admin@mei.com' }
    mockSignIn.mockResolvedValue({
      data: { user: mockUser, session: { access_token: 'tok' } },
      error: null,
    })
    const result = await signIn('admin@mei.com', 'pass')
    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeNull()
  })

  it('returns error message on failure', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })
    const result = await signIn('bad@email.com', 'bad')
    expect(result.user).toBeNull()
    expect(result.error).toBe('Invalid login credentials')
  })
})

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    await signOut()
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm run test:run -- __tests__/services/auth.test.ts
```

Expected: FAIL — "Cannot find module '@/services/auth'"

- [ ] **Step 3: Create `services/auth.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return {
    user: data.user ?? null,
    session: data.session ?? null,
    error: error?.message ?? null,
  }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npm run test:run -- __tests__/services/auth.test.ts
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add services/auth.ts __tests__/services/auth.test.ts
git commit -m "feat: auth service with signIn/signOut + passing tests"
```

---

### Task 6: Wire Login Page to Supabase Auth

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Read current login page**

Open `app/login/page.tsx`. Note the current form structure — all existing className values and layout must be preserved exactly.

- [ ] **Step 2: Add `'use client'` and replace form handler**

At the top of the file add `'use client'` if not present. Replace the existing static `handleSubmit` and error state with:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/services/auth'

// Inside the component, replace state and handler:
const router = useRouter()
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [error, setError] = useState<string | null>(null)
const [loading, setLoading] = useState(false)

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError(null)
  setLoading(true)
  const result = await signIn(email, password)
  if (result.error) {
    setError(result.error)
    setLoading(false)
    return
  }
  router.push('/dashboard')
  router.refresh()
}
```

Wire each form element — do not change any className:
```typescript
<form onSubmit={handleSubmit}>
  {/* email input: add value={email} onChange={(e) => setEmail(e.target.value)} required */}
  {/* password input: add value={password} onChange={(e) => setPassword(e.target.value)} required */}
  {/* error: replace static error with {error && <p className="...">{error}</p>} */}
  {/* submit button: add disabled={loading}, replace text with {loading ? 'Signing in…' : 'Sign In'} */}
</form>
```

- [ ] **Step 3: Create a test admin in Supabase dashboard**

Go to: Supabase Dashboard → Authentication → Users → "Invite user" or "Add user"
Create: `admin@mei.com` with a strong password.

- [ ] **Step 4: Test in browser**

1. `npm run dev`
2. Open `http://localhost:3000/login`
3. Enter wrong credentials → error message appears below the form
4. Enter correct admin credentials → redirected to `/dashboard`

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: wire login form to Supabase Auth"
```

---

### Task 7: Wire Sign Out in Sidebar

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Read current Sidebar.tsx**

Open `components/layout/Sidebar.tsx`. Find the Sign Out button near the bottom.

- [ ] **Step 2: Add `'use client'` and sign out handler**

If `'use client'` is not at the top, add it. Then add:

```typescript
import { useRouter } from 'next/navigation'
import { signOut } from '@/services/auth'

// Inside component:
const router = useRouter()

async function handleSignOut() {
  await signOut()
  router.push('/login')
  router.refresh()
}
```

Add `onClick={handleSignOut}` to the Sign Out button element.

- [ ] **Step 3: Test in browser**

1. Log in with admin credentials
2. Click the Sign Out button in the sidebar
3. Expected: session cleared, redirected to `/login`
4. Try navigating to `/dashboard` directly — expected: redirected back to `/login`

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: wire sidebar sign out to Supabase Auth"
```

---

### Task 8: Database Migration 001 — Profiles & Roles

**Files:**
- Create: `supabase/migrations/001_profiles_roles.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_profiles_roles.sql`:

```sql
-- Admin role enum
CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin');

-- Admin profiles extending Supabase auth.users
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.admin_role NOT NULL DEFAULT 'admin',
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile row whenever a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to: Supabase Dashboard → SQL Editor. Paste the migration and click Run.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify the trigger exists**

```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Expected: one row returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_profiles_roles.sql
git commit -m "feat: migration 001 — profiles and admin role enum"
```

---

### Task 9: Database Migration 002 — Categories & Products

**Files:**
- Create: `supabase/migrations/002_categories_products.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/002_categories_products.sql`:

```sql
-- Product status enum
CREATE TYPE public.product_status AS ENUM ('PUBLISHED', 'DRAFT');

-- Categories
CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_categories_active_sort
  ON public.categories(sort_order)
  WHERE deleted_at IS NULL;

-- Products
CREATE TABLE public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  work_types  TEXT[] NOT NULL DEFAULT '{}',
  status      public.product_status NOT NULL DEFAULT 'DRAFT',
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_products_category  ON public.products(category_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status    ON public.products(status)        WHERE deleted_at IS NULL;
CREATE INDEX idx_products_created   ON public.products(created_at DESC) WHERE deleted_at IS NULL;

-- Shared trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial categories matching existing mock data
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Bridal Lehengas', 'bridal-lehengas', 1),
  ('Sarees',          'sarees',          2),
  ('Evening Gowns',   'evening-gowns',   3),
  ('Couture',         'couture',         4),
  ('Suits',           'suits',           5);
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste and run. Expected: "Success."

- [ ] **Step 3: Verify categories seeded**

```sql
SELECT name, slug FROM public.categories ORDER BY sort_order;
```

Expected: 5 rows — Bridal Lehengas, Sarees, Evening Gowns, Couture, Suits.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_categories_products.sql
git commit -m "feat: migration 002 — categories and products tables"
```

---

### Task 10: Database Migration 003 — Customers & Orders

**Files:**
- Create: `supabase/migrations/003_customers_orders.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/003_customers_orders.sql`:

```sql
-- Order status enum
CREATE TYPE public.order_status AS ENUM (
  'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'
);

-- Customers
CREATE TABLE public.customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT UNIQUE,
  phone      TEXT,
  city       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_name  ON public.customers(name);

-- Orders
CREATE SEQUENCE public.order_number_seq START 9000;

CREATE TABLE public.orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('#ORD-' || nextval('public.order_number_seq')),
  customer_id  UUID REFERENCES public.customers(id),
  status       public.order_status NOT NULL DEFAULT 'PENDING',
  total        NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status   ON public.orders(status);
CREATE INDEX idx_orders_created  ON public.orders(created_at DESC);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Order items
CREATE TABLE public.order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor. Expected: "Success."**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_customers_orders.sql
git commit -m "feat: migration 003 — customers, orders, order_items"
```

---

### Task 11: Database Migration 004 — Enquiries, Banners, Settings

**Files:**
- Create: `supabase/migrations/004_enquiries_banners_settings.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Enquiry status enum
CREATE TYPE public.enquiry_status AS ENUM ('NEW', 'REPLIED', 'CLOSED');

-- Enquiries (contact form submissions from storefront)
CREATE TABLE public.enquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  status      public.enquiry_status NOT NULL DEFAULT 'NEW',
  admin_reply TEXT,
  replied_at  TIMESTAMPTZ,
  replied_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enquiries_status  ON public.enquiries(status);
CREATE INDEX idx_enquiries_created ON public.enquiries(created_at DESC);

-- Banners (homepage promotional images)
CREATE TABLE public.banners (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link_url   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_banners_active_sort
  ON public.banners(sort_order)
  WHERE is_active = true;

CREATE TRIGGER banners_set_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Settings — JSONB key-value store for app-wide config
CREATE TABLE public.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('store_name',        '"MEI Bridal Couture"',   'Display name of the store'),
  ('currency',          '"INR"',                   'Currency code'),
  ('orders_per_page',   '20',                      'Pagination size for orders table'),
  ('products_per_page', '20',                      'Pagination size for products table');
```

- [ ] **Step 2: Run in Supabase SQL Editor. Expected: "Success."**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_enquiries_banners_settings.sql
git commit -m "feat: migration 004 — enquiries, banners, settings"
```

---

### Task 12: Database Migration 005 — RLS Policies

**Files:**
- Create: `supabase/migrations/005_rls_policies.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings    ENABLE ROW LEVEL SECURITY;

-- Helper: is current JWT user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$;

-- Helper: is current JWT user a super_admin?
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$;

-- profiles
CREATE POLICY "Admins read profiles"
  ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Own profile update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- categories: admins full CRUD
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- products: admins full CRUD
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- customers: admins full CRUD
CREATE POLICY "Admins manage customers"
  ON public.customers FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- orders: admins read/insert/update; only super_admin deletes
CREATE POLICY "Admins read orders"
  ON public.orders FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins insert orders"
  ON public.orders FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Super admin delete orders"
  ON public.orders FOR DELETE USING (public.is_super_admin());

-- order_items: admins full CRUD
CREATE POLICY "Admins manage order_items"
  ON public.order_items FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- enquiries: admins full CRUD
CREATE POLICY "Admins manage enquiries"
  ON public.enquiries FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- banners: admins full CRUD
CREATE POLICY "Admins manage banners"
  ON public.banners FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- settings: admins read; only super_admin writes
CREATE POLICY "Admins read settings"
  ON public.settings FOR SELECT USING (public.is_admin());
CREATE POLICY "Super admin manage settings"
  ON public.settings FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
```

- [ ] **Step 2: Run in SQL Editor. Expected: "Success."**

- [ ] **Step 3: Elevate the initial admin to super_admin**

After running, go to: Supabase → Table Editor → profiles. Find the initial admin user row (created when you signed up). Change `role` from `admin` to `super_admin`.

Or run:
```sql
UPDATE public.profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@mei.com');
```

- [ ] **Step 4: Test RLS from SQL Editor**

```sql
-- Should return 0 rows (no JWT = unauthenticated)
SET LOCAL role = anon;
SELECT * FROM public.products;
```

Expected: 0 rows returned (RLS blocks anon access).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_rls_policies.sql
git commit -m "feat: migration 005 — RLS policies for all tables"
```

---

### Task 13: Database Migration 006 — Audit Logs

**Files:**
- Create: `supabase/migrations/006_audit_logs.sql`

- [ ] **Step 1: Create migration file**

```sql
CREATE TABLE public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,        -- 'CREATE', 'UPDATE', 'DELETE'
  resource_type TEXT NOT NULL,        -- 'product', 'order', 'banner', etc.
  resource_id   TEXT,
  old_data      JSONB,
  new_data      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_admin    ON public.audit_logs(admin_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created  ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON public.audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins insert audit logs"
  ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());
-- No UPDATE or DELETE policies — audit logs are append-only
```

- [ ] **Step 2: Run in SQL Editor. Expected: "Success."**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_audit_logs.sql
git commit -m "feat: migration 006 — append-only audit logs"
```

---

### Task 14: TypeScript Types + App-Level Type Aliases

**Files:**
- Replace: `types/database.ts`
- Create: `types/index.ts`

- [ ] **Step 1: Generate types from Supabase (preferred)**

If you have the Supabase CLI installed:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > types/database.ts
```

Replace `YOUR_PROJECT_REF` with the ref from your Supabase project URL (the part before `.supabase.co`).

- [ ] **Step 2: If CLI is not available, replace `types/database.ts` with hand-crafted types**

```typescript
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:    { id: string; role: 'admin' | 'super_admin'; full_name: string | null; created_at: string }
        Insert: { id: string; role?: 'admin' | 'super_admin'; full_name?: string | null }
        Update: { role?: 'admin' | 'super_admin'; full_name?: string | null }
      }
      categories: {
        Row:    { id: string; name: string; slug: string; description: string | null; sort_order: number; created_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; slug: string; description?: string | null; sort_order?: number }
        Update: { name?: string; slug?: string; description?: string | null; sort_order?: number; deleted_at?: string | null }
      }
      products: {
        Row:    { id: string; name: string; category_id: string | null; price: number; work_types: string[]; status: 'PUBLISHED' | 'DRAFT'; description: string | null; image_url: string | null; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; category_id?: string | null; price: number; work_types?: string[]; status?: 'PUBLISHED' | 'DRAFT'; description?: string | null; image_url?: string | null }
        Update: { name?: string; category_id?: string | null; price?: number; work_types?: string[]; status?: 'PUBLISHED' | 'DRAFT'; description?: string | null; image_url?: string | null; deleted_at?: string | null }
      }
      customers: {
        Row:    { id: string; name: string; email: string | null; phone: string | null; city: string | null; created_at: string }
        Insert: { id?: string; name: string; email?: string | null; phone?: string | null; city?: string | null }
        Update: { name?: string; email?: string | null; phone?: string | null; city?: string | null }
      }
      orders: {
        Row:    { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null }
      }
      order_items: {
        Row:    { id: string; order_id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; created_at: string }
        Insert: { id?: string; order_id: string; product_id?: string | null; product_name: string; quantity?: number; unit_price: number }
        Update: { quantity?: number; unit_price?: number }
      }
      enquiries: {
        Row:    { id: string; name: string; email: string; phone: string | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string }
        Insert: { id?: string; name: string; email: string; phone?: string | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null }
      }
      banners: {
        Row:    { id: string; title: string; image_url: string; link_url: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; title: string; image_url: string; link_url?: string | null; is_active?: boolean; sort_order?: number }
        Update: { title?: string; image_url?: string; link_url?: string | null; is_active?: boolean; sort_order?: number }
      }
      settings: {
        Row:    { key: string; value: unknown; description: string | null; updated_at: string; updated_by: string | null }
        Insert: { key: string; value: unknown; description?: string | null; updated_by?: string | null }
        Update: { value?: unknown; description?: string | null; updated_by?: string | null }
      }
      audit_logs: {
        Row:    { id: string; admin_id: string | null; action: string; resource_type: string; resource_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string }
        Insert: { id?: string; admin_id?: string | null; action: string; resource_type: string; resource_id?: string | null; old_data?: Record<string, unknown> | null; new_data?: Record<string, unknown> | null }
        Update: never
      }
    }
    Enums: {
      admin_role:    'admin' | 'super_admin'
      order_status:  'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
      product_status: 'PUBLISHED' | 'DRAFT'
      enquiry_status: 'NEW' | 'REPLIED' | 'CLOSED'
    }
  }
}
```

- [ ] **Step 3: Create `types/index.ts`**

```typescript
import type { Database } from './database'

type Tables = Database['public']['Tables']

export type Profile     = Tables['profiles']['Row']
export type Category    = Tables['categories']['Row']
export type Product     = Tables['products']['Row']
export type Customer    = Tables['customers']['Row']
export type Order       = Tables['orders']['Row']
export type OrderItem   = Tables['order_items']['Row']
export type Enquiry     = Tables['enquiries']['Row']
export type Banner      = Tables['banners']['Row']
export type Setting     = Tables['settings']['Row']
export type AuditLog    = Tables['audit_logs']['Row']

export type ProductInsert   = Tables['products']['Insert']
export type ProductUpdate   = Tables['products']['Update']
export type CategoryInsert  = Tables['categories']['Insert']
export type CategoryUpdate  = Tables['categories']['Update']
export type OrderUpdate     = Tables['orders']['Update']
export type EnquiryUpdate   = Tables['enquiries']['Update']
export type BannerInsert    = Tables['banners']['Insert']
export type BannerUpdate    = Tables['banners']['Update']
export type SettingUpdate   = Tables['settings']['Update']

export type OrderStatus   = Database['public']['Enums']['order_status']
export type ProductStatus = Database['public']['Enums']['product_status']
export type EnquiryStatus = Database['public']['Enums']['enquiry_status']
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add types/
git commit -m "feat: TypeScript types from database schema"
```

---

### Task 15: TanStack Query Provider + UI State Components

**Files:**
- Create: `providers/query-provider.tsx`
- Create: `components/ui/skeleton.tsx`
- Create: `components/ui/error-state.tsx`
- Create: `components/ui/empty-state.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `providers/query-provider.tsx`**

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: 2 },
      },
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Create `components/ui/skeleton.tsx`**

```typescript
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200 ${className ?? ''}`} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-10 w-10 shrink-0" />
          <Skeleton className="h-10 grow" />
          <Skeleton className="h-10 w-20 shrink-0" />
          <Skeleton className="h-10 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/ui/error-state.tsx`**

```typescript
interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-[#c9a465] underline underline-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/ui/empty-state.tsx`**

```typescript
interface EmptyStateProps {
  message: string
  action?: React.ReactNode
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-zinc-400">{message}</p>
      {action}
    </div>
  )
}
```

- [ ] **Step 5: Wrap root layout with QueryProvider**

Open `app/layout.tsx`. Import `QueryProvider` and wrap `{children}`:

```typescript
import { QueryProvider } from '@/providers/query-provider'

// In the JSX, wrap children:
<QueryProvider>
  {children}
</QueryProvider>
```

- [ ] **Step 6: Verify TypeScript + dev server**

```bash
npx tsc --noEmit && npm run dev
```

Expected: 0 type errors, dev server starts.

- [ ] **Step 7: Commit**

```bash
git add providers/ components/ui/ app/layout.tsx
git commit -m "feat: TanStack Query provider + skeleton/error/empty UI components"
```

---

### Task 16: Products Service + Tests

**Files:**
- Create: `services/products.ts`
- Create: `__tests__/services/products.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/services/products.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getProducts, createProduct, deleteProduct } = await import('@/services/products')

function mockChain(returnValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'ilike', 'order', 'range', 'single', 'limit']
  methods.forEach(m => { chain[m] = vi.fn().mockReturnValue(chain) })
  ;(chain as { then: (r: (v: unknown) => unknown) => unknown }).then = (resolve) => resolve(returnValue)
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('getProducts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns products and total', async () => {
    mockChain({ data: [{ id: '1', name: 'Test' }], count: 1, error: null })
    const result = await getProducts()
    expect(result.products).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('throws on Supabase error', async () => {
    mockChain({ data: null, count: null, error: { message: 'DB error' } })
    await expect(getProducts()).rejects.toThrow('DB error')
  })
})
```

- [ ] **Step 2: Run test — confirm fail**

```bash
npm run test:run -- __tests__/services/products.test.ts
```

Expected: FAIL — "Cannot find module '@/services/products'"

- [ ] **Step 3: Create `services/products.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import type { ProductInsert, ProductUpdate } from '@/types'

interface GetProductsOptions {
  page?: number
  limit?: number
  search?: string
  status?: 'PUBLISHED' | 'DRAFT'
  categoryId?: string
}

export async function getProducts(options: GetProductsOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, search, status, categoryId } = options

  let query = supabase
    .from('products')
    .select('*, categories(id, name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (search)     query = query.ilike('name', `%${search}%`)
  if (status)     query = query.eq('status', status)
  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { products: data ?? [], total: count ?? 0 }
}

export async function createProduct(product: ProductInsert) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateProduct(id: string, updates: ProductUpdate) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteProduct(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm run test:run -- __tests__/services/products.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/products.ts __tests__/services/products.test.ts
git commit -m "feat: products service with CRUD + tests"
```

---

### Task 17: Products Hooks

**Files:**
- Create: `hooks/use-products.ts`

- [ ] **Step 1: Create `hooks/use-products.ts`**

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/services/products'
import type { ProductInsert, ProductUpdate } from '@/types'

type GetProductsOptions = Parameters<typeof getProducts>[0]

export function useProducts(options?: GetProductsOptions) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: () => getProducts(options),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (product: ProductInsert) => createProduct(product),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProductUpdate }) =>
      updateProduct(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-products.ts
git commit -m "feat: useProducts hooks with TanStack Query"
```

---

### Task 18: Refactor Products Page to Use Hooks

**Files:**
- Modify: `app/(app)/products/page.tsx`

- [ ] **Step 1: Read the current products page**

Open `app/(app)/products/page.tsx`. Note all the state variables, the mock `fetchProducts()` call in `useEffect`, and the drawer form structure. You will replace data loading only — all JSX, styling, and drawer UI stays identical.

- [ ] **Step 2: Replace mock data imports and state with hooks**

At the top of the file, remove:
```typescript
import { fetchProducts, addProduct, updateProduct, deleteProduct } from '@/lib/mockDb'
```

Add:
```typescript
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/use-products'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
```

- [ ] **Step 3: Replace component body state**

Remove:
```typescript
const [products, setProducts] = useState<Product[]>([])
// and the useEffect that calls fetchProducts
```

Add at the top of the component:
```typescript
const [page, setPage] = useState(1)
const { data, isLoading, error, refetch } = useProducts({ page, limit: 6 })
const createProduct = useCreateProduct()
const updateProductMutation = useUpdateProduct()
const deleteProductMutation = useDeleteProduct()

const products = data?.products ?? []
const total    = data?.total ?? 0
const totalPages = Math.ceil(total / 6)
```

- [ ] **Step 4: Replace mutation handlers**

Replace the existing `handleSaveProduct` function:
```typescript
async function handleSaveProduct(e: React.FormEvent) {
  e.preventDefault()
  if (editingProduct) {
    await updateProductMutation.mutateAsync({
      id: editingProduct.id,
      updates: { name, category_id: categoryId, price: Number(price), work_types: workTypes, status },
    })
  } else {
    await createProduct.mutateAsync({
      name, category_id: categoryId, price: Number(price), work_types: workTypes, status,
    })
  }
  setDrawerOpen(false)
  resetForm()
}
```

Replace the `handleDeleteProduct` function:
```typescript
async function handleDeleteProduct(id: string) {
  await deleteProductMutation.mutateAsync(id)
}
```

- [ ] **Step 5: Add loading/error/empty states to JSX**

Before the table, add:
```typescript
if (isLoading) return <TableSkeleton rows={6} />
if (error)     return <ErrorState message={error.message} onRetry={refetch} />
if (products.length === 0) return <EmptyState message="No products yet." action={<AddButton />} />
```

- [ ] **Step 6: Update field names to match DB schema**

The DB uses `category_id` (UUID) not `category` (string). Update the form field and table cells accordingly:
- When displaying category name, use `product.categories?.name ?? product.category_id`
- When saving, map the selected category name to its UUID via a `useCategories()` hook (created in Task 19)

For now, use the category_id directly with a TODO comment. Revisit after Task 19.

- [ ] **Step 7: Test in browser**

1. `npm run dev` and log in
2. Navigate to `/products`
3. Verify: products load from Supabase (empty at first — that's correct)
4. Add a product via the drawer form
5. Verify: product appears in the table
6. Edit and delete a product — verify changes persist on page refresh

- [ ] **Step 8: Commit**

```bash
git add app/(app)/products/page.tsx
git commit -m "feat: products page wired to Supabase via hooks"
```

---

### Task 19: Supabase Storage + Product Image Upload

**Files:**
- Create: `services/storage.ts`
- Modify: `app/(app)/products/page.tsx` (image upload in drawer)

- [ ] **Step 1: Create storage bucket in Supabase dashboard**

Go to: Supabase Dashboard → Storage → New Bucket
- Name: `product-images`
- Public bucket: **Yes** (product images are public)
- Click Create

- [ ] **Step 2: Create `services/storage.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'product-images'

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `products/${productId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteProductImage(imageUrl: string) {
  const supabase = createClient()
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return
  const path = imageUrl.slice(idx + marker.length)
  await supabase.storage.from(BUCKET).remove([path])
}
```

- [ ] **Step 3: Add image file input to products drawer form**

In `app/(app)/products/page.tsx`, add to the drawer form (below the existing fields):

```typescript
// State for image file
const [imageFile, setImageFile] = useState<File | null>(null)
const [imagePreview, setImagePreview] = useState<string>('')

// Handler
function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setImageFile(file)
  setImagePreview(URL.createObjectURL(file))
}
```

In the drawer JSX, add:
```typescript
{/* Image upload */}
<div>
  <label className="block text-xs font-medium text-zinc-600 mb-1 uppercase tracking-widest">
    Product Image
  </label>
  {(imagePreview || editingProduct?.image_url) && (
    <img
      src={imagePreview || editingProduct?.image_url}
      alt="Preview"
      className="h-24 w-24 object-cover rounded mb-2 border border-[#e8e0d5]"
    />
  )}
  <input
    type="file"
    accept="image/*"
    onChange={handleImageChange}
    className="text-xs text-zinc-600"
  />
</div>
```

Update `handleSaveProduct` to upload the image before saving:
```typescript
async function handleSaveProduct(e: React.FormEvent) {
  e.preventDefault()
  let imageUrl = editingProduct?.image_url ?? ''

  if (imageFile) {
    const tempId = editingProduct?.id ?? crypto.randomUUID()
    imageUrl = await uploadProductImage(imageFile, tempId)
  }

  if (editingProduct) {
    await updateProductMutation.mutateAsync({
      id: editingProduct.id,
      updates: { name, price: Number(price), work_types: workTypes, status, image_url: imageUrl },
    })
  } else {
    await createProduct.mutateAsync({
      name, price: Number(price), work_types: workTypes, status, image_url: imageUrl,
    })
  }
  setDrawerOpen(false)
  resetForm()
}
```

- [ ] **Step 4: Import `uploadProductImage` in products page**

```typescript
import { uploadProductImage } from '@/services/storage'
```

- [ ] **Step 5: Test image upload in browser**

1. Open `/products` → click Add Product
2. Fill form fields + choose an image file
3. Submit → verify the product row shows the image from Supabase Storage URL
4. Edit the product → change the image → verify the new image URL is saved

- [ ] **Step 6: Commit**

```bash
git add services/storage.ts app/(app)/products/page.tsx
git commit -m "feat: Supabase Storage integration for product image upload"
```

---

### Task 20: Categories Module

**Files:**
- Create: `services/categories.ts`
- Create: `hooks/use-categories.ts`
- Create: `app/(app)/categories/page.tsx`

- [ ] **Step 1: Create `services/categories.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import type { CategoryInsert, CategoryUpdate } from '@/types'

export async function getCategories() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCategory(category: CategoryInsert) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateCategory(id: string, updates: CategoryUpdate) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteCategory(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Create `hooks/use-categories.ts`**

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categories'
import type { CategoryInsert, CategoryUpdate } from '@/types'

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: getCategories })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: CategoryInsert) => createCategory(c),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CategoryUpdate }) => updateCategory(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
```

- [ ] **Step 3: Create `app/(app)/categories/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-categories'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Category } from '@/types'

export default function CategoriesPage() {
  const { data: categories = [], isLoading, error, refetch } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')

  function openCreate() {
    setEditing(null); setName(''); setSlug(''); setDescription('')
    setDrawerOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat); setName(cat.name); setSlug(cat.slug); setDescription(cat.description ?? '')
    setDrawerOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      await update.mutateAsync({ id: editing.id, updates: { name, slug, description } })
    } else {
      await create.mutateAsync({ name, slug, description })
    }
    setDrawerOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    await remove.mutateAsync(id)
  }

  if (isLoading) return <TableSkeleton />
  if (error)     return <ErrorState message={(error as Error).message} onRetry={refetch} />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cormorant text-2xl font-semibold text-zinc-800">Categories</h1>
        <button
          onClick={openCreate}
          className="bg-[#c9a465] text-white text-xs uppercase tracking-widest px-4 py-2 rounded"
        >
          Add Category
        </button>
      </div>

      {categories.length === 0 ? (
        <EmptyState message="No categories yet." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e8e0d5] text-left text-xs uppercase tracking-widest text-zinc-400">
              <th className="py-3 pr-4">Name</th>
              <th className="py-3 pr-4">Slug</th>
              <th className="py-3 pr-4">Description</th>
              <th className="py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} className="border-b border-[#f0ebe4] hover:bg-[#faf8f5]">
                <td className="py-3 pr-4 font-medium text-zinc-800">{cat.name}</td>
                <td className="py-3 pr-4 text-zinc-500">{cat.slug}</td>
                <td className="py-3 pr-4 text-zinc-500 truncate max-w-xs">{cat.description ?? '—'}</td>
                <td className="py-3 flex gap-3">
                  <button onClick={() => openEdit(cat)} className="text-xs text-zinc-500 hover:text-zinc-800">Edit</button>
                  <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-96 bg-white h-full shadow-xl p-6 flex flex-col gap-4">
            <h2 className="font-cormorant text-xl font-semibold">
              {editing ? 'Edit Category' : 'Add Category'}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">Name</label>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); if (!editing) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')) }}
                  required
                  className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">Slug</label>
                <input value={slug} onChange={e => setSlug(e.target.value)} required
                  className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm resize-none" />
              </div>
              <button type="submit"
                className="bg-[#c9a465] text-white text-xs uppercase tracking-widest px-4 py-2 rounded mt-2">
                {editing ? 'Save Changes' : 'Add Category'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Test in browser — navigate to `/categories`**

Verify: 5 seeded categories load. Add, edit, delete categories. Changes persist on refresh.

- [ ] **Step 5: Commit**

```bash
git add services/categories.ts hooks/use-categories.ts app/(app)/categories/
git commit -m "feat: categories module — service, hooks, page"
```

---

### Task 21: Orders Module

**Files:**
- Create: `services/orders.ts`
- Create: `hooks/use-orders.ts`
- Create: `app/(app)/orders/page.tsx`

- [ ] **Step 1: Create `services/orders.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import type { OrderUpdate, OrderStatus } from '@/types'

interface GetOrdersOptions {
  page?: number
  limit?: number
  status?: OrderStatus
  search?: string
}

export async function getOrders(options: GetOrdersOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, status, search } = options

  let query = supabase
    .from('orders')
    .select('*, customers(id, name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('order_number', `%${search}%`)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { orders: data ?? [], total: count ?? 0 }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ status } satisfies OrderUpdate)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 2: Create `hooks/use-orders.ts`**

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateOrderStatus } from '@/services/orders'
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
```

- [ ] **Step 3: Create `app/(app)/orders/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useOrders, useUpdateOrderStatus } from '@/hooks/use-orders'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { OrderStatus } from '@/types'

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING:    'bg-yellow-100 text-yellow-700',
  CONFIRMED:  'bg-blue-100   text-blue-700',
  PROCESSING: 'bg-purple-100 text-purple-700',
  SHIPPED:    'bg-indigo-100 text-indigo-700',
  DELIVERED:  'bg-green-100  text-green-700',
  CANCELLED:  'bg-red-100    text-red-600',
}

const ALL_STATUSES: OrderStatus[] = ['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED']

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined)
  const { data, isLoading, error, refetch } = useOrders({ page, limit: 20, status: statusFilter })
  const updateStatus = useUpdateOrderStatus()

  const orders = data?.orders ?? []
  const total  = data?.total ?? 0

  if (isLoading) return <TableSkeleton />
  if (error)     return <ErrorState message={(error as Error).message} onRetry={refetch} />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cormorant text-2xl font-semibold text-zinc-800">Orders</h1>
        <p className="text-sm text-zinc-400">{total} total</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setStatusFilter(undefined); setPage(1) }}
          className={`text-xs px-3 py-1 rounded-full border ${!statusFilter ? 'bg-[#c9a465] text-white border-[#c9a465]' : 'border-[#e8e0d5] text-zinc-500'}`}
        >
          All
        </button>
        {ALL_STATUSES.map(s => (
          <button key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`text-xs px-3 py-1 rounded-full border ${statusFilter === s ? 'bg-[#c9a465] text-white border-[#c9a465]' : 'border-[#e8e0d5] text-zinc-500'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState message="No orders found." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e8e0d5] text-left text-xs uppercase tracking-widest text-zinc-400">
              <th className="py-3 pr-4">Order #</th>
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Total</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Date</th>
              <th className="py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id} className="border-b border-[#f0ebe4] hover:bg-[#faf8f5]">
                <td className="py-3 pr-4 font-medium text-zinc-800">{order.order_number}</td>
                <td className="py-3 pr-4 text-zinc-600">{(order.customers as { name: string } | null)?.name ?? '—'}</td>
                <td className="py-3 pr-4 text-zinc-800">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(order.total)}
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                    {order.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-zinc-400 text-xs">
                  {new Date(order.created_at).toLocaleDateString('en-IN')}
                </td>
                <td className="py-3">
                  <select
                    value={order.status}
                    onChange={e => updateStatus.mutate({ id: order.id, status: e.target.value as OrderStatus })}
                    className="text-xs border border-[#e8e0d5] rounded px-2 py-1 bg-white"
                  >
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex gap-2 mt-4 justify-end">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="text-xs px-3 py-1 border border-[#e8e0d5] rounded disabled:opacity-40">Prev</button>
          <button disabled={orders.length < 20} onClick={() => setPage(p => p + 1)}
            className="text-xs px-3 py-1 border border-[#e8e0d5] rounded disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Test in browser — navigate to `/orders`**

Verify: orders table loads. Status filter tabs work. Status dropdown updates status in real-time.

- [ ] **Step 5: Commit**

```bash
git add services/orders.ts hooks/use-orders.ts app/(app)/orders/
git commit -m "feat: orders module — service, hooks, page with status management"
```

---

### Task 22: Enquiries Module

**Files:**
- Create: `services/enquiries.ts`
- Create: `hooks/use-enquiries.ts`
- Create: `app/(app)/enquiries/page.tsx`

- [ ] **Step 1: Create `services/enquiries.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import type { EnquiryStatus } from '@/types'

export async function getEnquiries(options: { page?: number; limit?: number; status?: EnquiryStatus } = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, status } = options

  let query = supabase
    .from('enquiries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { enquiries: data ?? [], total: count ?? 0 }
}

export async function replyToEnquiry(id: string, reply: string, adminId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('enquiries')
    .update({ admin_reply: reply, replied_at: new Date().toISOString(), replied_by: adminId, status: 'REPLIED' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function closeEnquiry(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('enquiries')
    .update({ status: 'CLOSED' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Create `hooks/use-enquiries.ts`**

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEnquiries, replyToEnquiry, closeEnquiry } from '@/services/enquiries'
import { createClient } from '@/lib/supabase/client'
import type { EnquiryStatus } from '@/types'

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
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      return replyToEnquiry(id, reply, user!.id)
    },
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
```

- [ ] **Step 3: Create `app/(app)/enquiries/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useEnquiries, useReplyToEnquiry, useCloseEnquiry } from '@/hooks/use-enquiries'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Enquiry, EnquiryStatus } from '@/types'

const STATUS_COLORS: Record<EnquiryStatus, string> = {
  NEW:     'bg-yellow-100 text-yellow-700',
  REPLIED: 'bg-green-100  text-green-700',
  CLOSED:  'bg-zinc-100   text-zinc-500',
}

export default function EnquiriesPage() {
  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | undefined>(undefined)
  const { data, isLoading, error, refetch } = useEnquiries({ status: statusFilter })
  const reply = useReplyToEnquiry()
  const close = useCloseEnquiry()

  const [selected, setSelected] = useState<Enquiry | null>(null)
  const [replyText, setReplyText] = useState('')

  const enquiries = data?.enquiries ?? []

  if (isLoading) return <TableSkeleton />
  if (error)     return <ErrorState message={(error as Error).message} onRetry={refetch} />

  return (
    <div className="p-6 flex gap-6">
      {/* List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cormorant text-2xl font-semibold text-zinc-800">Enquiries</h1>
          <p className="text-sm text-zinc-400">{data?.total ?? 0} total</p>
        </div>

        <div className="flex gap-2 mb-4">
          {([undefined, 'NEW', 'REPLIED', 'CLOSED'] as const).map(s => (
            <button key={String(s)}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1 rounded-full border ${statusFilter === s ? 'bg-[#c9a465] text-white border-[#c9a465]' : 'border-[#e8e0d5] text-zinc-500'}`}
            >
              {s ?? 'All'}
            </button>
          ))}
        </div>

        {enquiries.length === 0 ? (
          <EmptyState message="No enquiries." />
        ) : (
          <div className="divide-y divide-[#f0ebe4]">
            {enquiries.map(enq => (
              <div key={enq.id}
                onClick={() => { setSelected(enq); setReplyText(enq.admin_reply ?? '') }}
                className={`py-4 cursor-pointer hover:bg-[#faf8f5] px-2 rounded ${selected?.id === enq.id ? 'bg-[#faf8f5]' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-zinc-800 text-sm">{enq.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[enq.status]}`}>{enq.status}</span>
                </div>
                <p className="text-xs text-zinc-400">{enq.email} · {enq.phone ?? ''}</p>
                <p className="text-xs text-zinc-500 mt-1 truncate">{enq.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail / Reply panel */}
      {selected && (
        <div className="w-96 shrink-0 bg-white border border-[#e8e0d5] rounded p-5 h-fit sticky top-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-cormorant text-lg font-semibold">{selected.name}</h2>
            <button onClick={() => setSelected(null)} className="text-xs text-zinc-400">✕</button>
          </div>
          <p className="text-xs text-zinc-400 mb-1">{selected.email} {selected.phone ? `· ${selected.phone}` : ''}</p>
          <p className="text-sm text-zinc-700 mt-3 leading-relaxed">{selected.message}</p>

          {selected.status !== 'CLOSED' && (
            <div className="mt-5">
              <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">Reply</label>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4}
                className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm resize-none mb-3" />
              <div className="flex gap-2">
                <button
                  onClick={() => reply.mutate({ id: selected.id, reply: replyText }, { onSuccess: () => setSelected(null) })}
                  className="flex-1 bg-[#c9a465] text-white text-xs uppercase tracking-widest py-2 rounded"
                >
                  Send Reply
                </button>
                <button
                  onClick={() => close.mutate(selected.id, { onSuccess: () => setSelected(null) })}
                  className="text-xs border border-[#e8e0d5] px-3 py-2 rounded text-zinc-500"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Test in browser — navigate to `/enquiries`**

Verify: enquiries load, clicking an enquiry shows detail panel, reply saves and changes status to REPLIED.

- [ ] **Step 5: Commit**

```bash
git add services/enquiries.ts hooks/use-enquiries.ts app/(app)/enquiries/
git commit -m "feat: enquiries module — service, hooks, page with reply panel"
```

---

### Task 23: Banners Module

**Files:**
- Create: `services/banners.ts`
- Create: `hooks/use-banners.ts`
- Create: `app/(app)/banners/page.tsx`

- [ ] **Step 1: Create `services/banners.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import type { BannerInsert, BannerUpdate } from '@/types'

export async function getBanners() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createBanner(banner: BannerInsert) {
  const supabase = createClient()
  const { data, error } = await supabase.from('banners').insert(banner).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateBanner(id: string, updates: BannerUpdate) {
  const supabase = createClient()
  const { data, error } = await supabase.from('banners').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteBanner(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('banners').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Create `hooks/use-banners.ts`**

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBanners, createBanner, updateBanner, deleteBanner } from '@/services/banners'
import type { BannerInsert, BannerUpdate } from '@/types'

export function useBanners() {
  return useQuery({ queryKey: ['banners'], queryFn: getBanners })
}

export function useCreateBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: BannerInsert) => createBanner(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banners'] }),
  })
}

export function useUpdateBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: BannerUpdate }) => updateBanner(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banners'] }),
  })
}

export function useDeleteBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banners'] }),
  })
}
```

- [ ] **Step 3: Create `app/(app)/banners/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useBanners, useCreateBanner, useUpdateBanner, useDeleteBanner } from '@/hooks/use-banners'
import { uploadProductImage } from '@/services/storage'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Banner } from '@/types'

export default function BannersPage() {
  const { data: banners = [], isLoading, error, refetch } = useBanners()
  const create = useCreateBanner()
  const update = useUpdateBanner()
  const remove = useDeleteBanner()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [title, setTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')

  function openCreate() {
    setEditing(null); setTitle(''); setLinkUrl(''); setIsActive(true); setImageFile(null); setImagePreview('')
    setDrawerOpen(true)
  }
  function openEdit(b: Banner) {
    setEditing(b); setTitle(b.title); setLinkUrl(b.link_url ?? ''); setIsActive(b.is_active); setImageFile(null); setImagePreview('')
    setDrawerOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    let imageUrl = editing?.image_url ?? ''
    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile, editing?.id ?? crypto.randomUUID())
    }
    if (editing) {
      await update.mutateAsync({ id: editing.id, updates: { title, link_url: linkUrl, is_active: isActive, image_url: imageUrl } })
    } else {
      if (!imageUrl) return alert('Please select an image')
      await create.mutateAsync({ title, link_url: linkUrl, is_active: isActive, image_url: imageUrl })
    }
    setDrawerOpen(false)
  }

  if (isLoading) return <TableSkeleton />
  if (error)     return <ErrorState message={(error as Error).message} onRetry={refetch} />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cormorant text-2xl font-semibold text-zinc-800">Banners</h1>
        <button onClick={openCreate} className="bg-[#c9a465] text-white text-xs uppercase tracking-widest px-4 py-2 rounded">
          Add Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <EmptyState message="No banners yet." />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {banners.map(b => (
            <div key={b.id} className="border border-[#e8e0d5] rounded overflow-hidden">
              <img src={b.image_url} alt={b.title} className="w-full h-40 object-cover" />
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{b.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(b)} className="text-xs text-zinc-500 hover:text-zinc-800">Edit</button>
                  <button onClick={() => remove.mutate(b.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-96 bg-white h-full shadow-xl p-6 flex flex-col gap-4">
            <h2 className="font-cormorant text-xl font-semibold">{editing ? 'Edit Banner' : 'Add Banner'}</h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">Link URL</label>
                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">Image</label>
                {(imagePreview || editing?.image_url) && (
                  <img src={imagePreview || editing?.image_url} alt="preview" className="h-24 w-full object-cover rounded mb-2" />
                )}
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)) } }} className="text-xs" />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                Active
              </label>
              <button type="submit" className="bg-[#c9a465] text-white text-xs uppercase tracking-widest px-4 py-2 rounded mt-2">
                {editing ? 'Save Changes' : 'Add Banner'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Test in browser**

Navigate to `/banners`. Add a banner with image upload. Toggle active/inactive. Delete a banner.

- [ ] **Step 5: Commit**

```bash
git add services/banners.ts hooks/use-banners.ts app/(app)/banners/
git commit -m "feat: banners module — service, hooks, page with image upload"
```

---

### Task 24: Settings Module

**Files:**
- Create: `services/settings.ts`
- Create: `hooks/use-settings.ts`
- Create: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Create `services/settings.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'

export async function getSettings() {
  const supabase = createClient()
  const { data, error } = await supabase.from('settings').select('*').order('key')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateSetting(key: string, value: unknown) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('settings')
    .update({ value, updated_by: user?.id, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Create `hooks/use-settings.ts`**

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSetting } from '@/services/settings'

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: getSettings })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => updateSetting(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
```

- [ ] **Step 3: Create `app/(app)/settings/page.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useSettings, useUpdateSetting } from '@/hooks/use-settings'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import type { Setting } from '@/types'

export default function SettingsPage() {
  const { data: settings = [], isLoading, error, refetch } = useSettings()
  const updateSetting = useUpdateSetting()
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const initial: Record<string, string> = {}
    settings.forEach(s => { initial[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value) })
    setLocalValues(initial)
  }, [settings])

  async function handleSave(key: string) {
    let parsed: unknown = localValues[key]
    try { parsed = JSON.parse(localValues[key]) } catch { /* treat as string */ }
    await updateSetting.mutateAsync({ key, value: parsed })
    setSaved(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000)
  }

  if (isLoading) return <TableSkeleton rows={4} />
  if (error)     return <ErrorState message={(error as Error).message} onRetry={refetch} />

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-cormorant text-2xl font-semibold text-zinc-800 mb-6">Settings</h1>

      <div className="divide-y divide-[#f0ebe4]">
        {settings.map((s: Setting) => (
          <div key={s.key} className="py-5 flex items-start gap-4">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">{s.key}</label>
              {s.description && <p className="text-xs text-zinc-400 mb-2">{s.description}</p>}
              <input
                value={localValues[s.key] ?? ''}
                onChange={e => setLocalValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => handleSave(s.key)}
              className="mt-6 bg-[#c9a465] text-white text-xs uppercase tracking-widest px-4 py-2 rounded shrink-0"
            >
              {saved[s.key] ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test in browser**

Navigate to `/settings`. Verify 4 default settings load. Edit a value and save — confirm it persists after page refresh.

**Note:** Settings writes are restricted to `super_admin` via RLS. If you get a 403, confirm the current user has `super_admin` role in the profiles table.

- [ ] **Step 5: Commit**

```bash
git add services/settings.ts hooks/use-settings.ts app/(app)/settings/
git commit -m "feat: settings module — service, hooks, editable key-value page"
```

---

### Task 25: Dashboard — Real Data via Server Component

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Read current dashboard page**

Open `app/(app)/dashboard/page.tsx`. Note which values are currently hardcoded (totalProducts, totalOrders, newEnquiries, revenue, recentOrders).

- [ ] **Step 2: Convert to async Server Component with real DB queries**

Replace the entire component content. Keep ALL existing JSX and className values. Only replace data sources:

```typescript
// Remove 'use client', useState, useEffect, and mockDb imports.
// The file becomes an async Server Component.

import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalProducts },
    { count: totalOrders },
    { count: newEnquiries },
    { data: recentOrdersRaw },
    { data: deliveredOrders },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }).eq('status', 'NEW'),
    supabase.from('orders')
      .select('id, order_number, customers(name), total, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('orders').select('total').eq('status', 'DELIVERED'),
  ])

  const revenue = deliveredOrders?.reduce((sum, o) => sum + Number(o.total), 0) ?? 0

  const recentOrders = (recentOrdersRaw ?? []).map(o => ({
    id:           o.id,
    order_number: o.order_number,
    customerName: (o.customers as { name: string } | null)?.name ?? 'Unknown',
    total:        Number(o.total),
    status:       o.status,
    date:         o.created_at,
  }))

  // Now use totalProducts, totalOrders, newEnquiries, revenue, recentOrders
  // in the existing JSX (replacing the old hardcoded/state values).
  return (
    // ... existing JSX with real values substituted ...
    <div>...</div>
  )
}
```

- [ ] **Step 3: Verify TypeScript + test in browser**

```bash
npx tsc --noEmit
npm run dev
```

Navigate to `/dashboard`. Verify stats show real counts. The recent orders table shows the latest 5 orders from Supabase.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "feat: dashboard fetches real stats from Supabase via Server Component"
```

---

### Task 26: Real-Time Orders Subscription

**Files:**
- Create: `hooks/use-realtime-orders.ts`
- Modify: `app/(app)/orders/page.tsx`

- [ ] **Step 1: Create `hooks/use-realtime-orders.ts`**

```typescript
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeOrders() {
  const qc = useQueryClient()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // Invalidate orders query so TanStack Query refetches
          qc.invalidateQueries({ queryKey: ['orders'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [qc])
}
```

- [ ] **Step 2: Add real-time hook to orders page**

In `app/(app)/orders/page.tsx`, import and call the hook at the top of the component:

```typescript
import { useRealtimeOrders } from '@/hooks/use-realtime-orders'

// Inside the component, add one line:
useRealtimeOrders()
```

That's the entire change — the hook wires up the subscription; TanStack Query handles the refetch and re-render.

- [ ] **Step 3: Enable Realtime for orders table in Supabase**

Go to: Supabase Dashboard → Database → Replication → Tables
Enable replication for: `public.orders`

- [ ] **Step 4: Test real-time in browser**

1. Open two browser tabs, both on `/orders`
2. In Supabase SQL Editor, run:
   ```sql
   INSERT INTO public.customers (name, email) VALUES ('Test Customer', 'test@example.com');
   INSERT INTO public.orders (customer_id, total, status)
   SELECT id, 50000, 'PENDING' FROM public.customers WHERE email = 'test@example.com';
   ```
3. Without refreshing either tab, verify the new order appears in both within ~2 seconds.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-realtime-orders.ts app/(app)/orders/page.tsx
git commit -m "feat: real-time order updates via Supabase Realtime + TanStack Query"
```

---

### Task 27: Fix Category Selector in Products Page

**Files:**
- Modify: `app/(app)/products/page.tsx`

This task resolves the TODO left in Task 18 — the products drawer now needs to map category names to UUIDs.

- [ ] **Step 1: Import `useCategories` in products page**

```typescript
import { useCategories } from '@/hooks/use-categories'
```

- [ ] **Step 2: Add categories query to component**

Inside the component body:
```typescript
const { data: categories = [] } = useCategories()
```

- [ ] **Step 3: Replace hardcoded category array with categories from DB**

Find the existing hardcoded categories array in the drawer form:
```typescript
// REMOVE this:
const CATEGORIES = ['Bridal Lehengas', 'Sarees', 'Evening Gowns', 'Couture', 'Suits']
```

Replace the category `<select>` dropdown to use real categories:
```typescript
<select
  value={categoryId}
  onChange={e => setCategoryId(e.target.value)}
  className="w-full border border-[#e8e0d5] rounded px-3 py-2 text-sm"
>
  <option value="">Select category</option>
  {categories.map(cat => (
    <option key={cat.id} value={cat.id}>{cat.name}</option>
  ))}
</select>
```

Update the state variable from `const [category, setCategory] = useState('')` to `const [categoryId, setCategoryId] = useState('')`.

Update `handleSaveProduct` to pass `category_id: categoryId`.

When opening edit drawer, set `setCategoryId(editingProduct.category_id ?? '')`.

In the table display, show `product.categories?.name` instead of `product.category`.

- [ ] **Step 4: Test in browser**

Open products drawer → category dropdown shows DB categories. Save a product with a category → category name displays in table.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/products/page.tsx
git commit -m "fix: products category selector now uses real categories from DB"
```

---

### Task 28: Delete mockDb and Final Cleanup

**Files:**
- Delete: `lib/mockDb.ts`
- Modify: `app/(app)/dashboard/page.tsx` (remove any remaining imports)

- [ ] **Step 1: Search for remaining mockDb imports**

```bash
grep -r "mockDb" app/ components/ lib/ --include="*.ts" --include="*.tsx"
```

Expected: 0 results. If any remain, update those files to use the real service functions before proceeding.

- [ ] **Step 2: Delete `lib/mockDb.ts`**

```bash
rm lib/mockDb.ts
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run dev server + smoke test every page**

```bash
npm run dev
```

Visit each route and confirm it loads:
- `/dashboard` — stats and recent orders
- `/products` — product table with real data
- `/categories` — 5 seeded categories
- `/orders` — orders table
- `/enquiries` — enquiries list
- `/banners` — banners grid
- `/settings` — settings form

- [ ] **Step 5: Final commit**

```bash
git rm lib/mockDb.ts
git add -A
git commit -m "chore: remove mockDb — all modules now backed by Supabase"
```

---

### Task 29: Type Check + Run All Tests

**Files:** None

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 2: TypeScript strict check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Fix any lint errors before proceeding.

- [ ] **Step 4: Production build**

```bash
npm run build
```

Expected: Build completes with no errors. Review any warnings.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: all modules passing type check, tests, lint, and build"
```

---

## Implementation Checklist

- [ ] Task 1: Dependencies + test setup
- [ ] Task 2: Environment variables
- [ ] Task 3: Supabase client utilities
- [ ] Task 4: Middleware (route protection)
- [ ] Task 5: Auth service + tests
- [ ] Task 6: Wire login page
- [ ] Task 7: Wire sign out
- [ ] Task 8: Migration 001 — profiles
- [ ] Task 9: Migration 002 — categories + products
- [ ] Task 10: Migration 003 — orders
- [ ] Task 11: Migration 004 — enquiries + banners + settings
- [ ] Task 12: Migration 005 — RLS
- [ ] Task 13: Migration 006 — audit logs
- [ ] Task 14: TypeScript types
- [ ] Task 15: TanStack Query provider + UI components
- [ ] Task 16: Products service + tests
- [ ] Task 17: Products hooks
- [ ] Task 18: Refactor products page
- [ ] Task 19: Storage + image upload
- [ ] Task 20: Categories module
- [ ] Task 21: Orders module
- [ ] Task 22: Enquiries module
- [ ] Task 23: Banners module
- [ ] Task 24: Settings module
- [ ] Task 25: Dashboard Server Component
- [ ] Task 26: Real-time orders
- [ ] Task 27: Fix category selector
- [ ] Task 28: Delete mockDb + cleanup
- [ ] Task 29: Type check + build

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Next.js 16 breaking changes to `cookies()` API | Medium | High | Check `node_modules/next/dist/docs/` in Task 1; the `await cookies()` pattern already addresses the known change |
| RLS blocks legitimate admin writes | Medium | Medium | Set admin user role to `super_admin` in profiles table (Task 12 Step 3) |
| Supabase Storage CORS issues | Low | Medium | Ensure bucket is public; set allowed origins in Supabase Storage settings |
| TanStack Query v5 API differences from v4 | Low | Low | Docs are in `node_modules/@tanstack/react-query/build/modern/` |
| `@supabase/ssr` version incompatible with Next.js 16 | Low | High | Check GitHub releases of `@supabase/ssr` if build fails |
| Multiple admins editing same record simultaneously | Low | Medium | `updated_at` used in all update queries; future: add optimistic concurrency via `version_number` |
| Realtime subscription silently drops | Medium | Low | Task 26 pattern (invalidate + refetch) is resilient; stale state corrected on next query |
| Storage uploads blocked by missing bucket policy | Medium | Medium | Task 31 adds explicit storage RLS policies |

---

## Phase 5: Production Hardening

Execute after Phase 4 passes build and all tests.

---

### Task 30: Standardized Error Handling Utility

**Files:**
- Create: `lib/errors.ts`
- Create: `lib/api-client.ts`

- [ ] **Step 1: Create `lib/errors.ts`**

```typescript
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'NOT_FOUND'
  | 'DB_ERROR'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('jwt') || msg.includes('session') || msg.includes('not authenticated'))
      return new AppError('AUTH_EXPIRED', err.message)
    if (msg.includes('row-level') || msg.includes('permission') || msg.includes('policy'))
      return new AppError('AUTH_FORBIDDEN', err.message)
    if (msg.includes('not found') || msg.includes('no rows'))
      return new AppError('NOT_FOUND', err.message)
    if (msg.includes('storage') || msg.includes('upload') || msg.includes('bucket'))
      return new AppError('STORAGE_ERROR', err.message)
    return new AppError('DB_ERROR', err.message)
  }
  return new AppError('UNKNOWN_ERROR', 'An unexpected error occurred', err)
}

export function getErrorMessage(err: unknown): string {
  return toAppError(err).message
}
```

- [ ] **Step 2: Update all service files to use `toAppError`**

In each service (`services/products.ts`, `services/orders.ts`, etc.), replace the `throw new Error(error.message)` pattern:

```typescript
// Before
if (error) throw new Error(error.message)

// After
import { toAppError } from '@/lib/errors'
if (error) throw toAppError(new Error(error.message))
```

- [ ] **Step 3: Update `ErrorState` component to handle AppError codes**

In `components/ui/error-state.tsx`, add a `code` prop for differentiated display:

```typescript
import type { AppError } from '@/lib/errors'

interface ErrorStateProps {
  error: AppError | Error | string
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const message = typeof error === 'string' ? error : error.message
  const isAuth = typeof error === 'object' && 'code' in error &&
    (error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_FORBIDDEN')

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {isAuth && (
        <p className="text-xs text-zinc-400">
          You may need to{' '}
          <a href="/login" className="text-[#c9a465] underline">sign in again</a>.
        </p>
      )}
      {onRetry && !isAuth && (
        <button onClick={onRetry} className="text-sm text-[#c9a465] underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run all tests to verify no regressions**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/errors.ts components/ui/error-state.tsx services/
git commit -m "feat: standardized AppError class and error code classification"
```

---

### Task 31: Migration 007 — Storage Security Policies

**Files:**
- Create: `supabase/migrations/007_storage_policies.sql`
- Modify: `services/storage.ts`

- [ ] **Step 1: Create migration file**

```sql
-- Storage policy: only authenticated admins can upload to product-images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
    AND (storage.foldername(name))[1] = 'products'
  );

-- Allow admins to update/delete their uploads
CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- Public read (product images are public)
CREATE POLICY "Public can read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
```

- [ ] **Step 2: Run in Supabase SQL Editor. Expected: "Success."**

- [ ] **Step 3: Add client-side file validation to `services/storage.ts`**

Add before the upload call:

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export function validateImageFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AppError('VALIDATION_ERROR', `File type not allowed. Use: ${ALLOWED_TYPES.join(', ')}`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new AppError('VALIDATION_ERROR', `File too large. Maximum size is 5MB.`)
  }
}

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  validateImageFile(file)  // Add this line at the top
  // ... rest of existing function unchanged
}
```

- [ ] **Step 4: Test upload validation in browser**

1. Try uploading a `.pdf` → error message "File type not allowed"
2. Try uploading an image > 5MB → error message "File too large"
3. Upload a valid `.jpg` → succeeds as before

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_storage_policies.sql services/storage.ts
git commit -m "feat: storage RLS policies + client-side file type/size validation"
```

---

### Task 32: Migration 008 — Performance Indexes

**Files:**
- Create: `supabase/migrations/008_performance_indexes.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Compound index for the most common orders query (status + date range)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders(status, created_at DESC);

-- Compound index for product listing (status + category)
CREATE INDEX IF NOT EXISTS idx_products_status_category
  ON public.products(status, category_id)
  WHERE deleted_at IS NULL;

-- Full-text search on product name (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING GIN (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Full-text search on customer name
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON public.customers USING GIN (name gin_trgm_ops);

-- Enquiries by email for duplicate detection
CREATE INDEX IF NOT EXISTS idx_enquiries_email
  ON public.enquiries(email);

-- Settings lookup is always by primary key — no extra index needed
-- Orders by customer (dashboard: "orders for this customer")
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON public.orders(customer_id, created_at DESC);
```

- [ ] **Step 2: Run in SQL Editor. Expected: "Success."**

- [ ] **Step 3: Update product search to use trigram similarity**

In `services/products.ts`, the existing `ilike` search already benefits from the trigram index automatically. No code change needed — PostgreSQL uses `gin_trgm_ops` transparently with `ILIKE`.

Verify in Supabase SQL Editor:
```sql
EXPLAIN SELECT * FROM public.products WHERE name ILIKE '%noor%';
```

Expected: "Bitmap Index Scan on idx_products_name_trgm" in the query plan.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_performance_indexes.sql
git commit -m "feat: migration 008 — compound indexes and trigram full-text search"
```

---

### Task 33: Enhanced Audit Logging

**Files:**
- Create: `supabase/migrations/009_audit_log_enhancements.sql`
- Create: `lib/audit.ts`

- [ ] **Step 1: Create migration**

```sql
-- Add user_agent to audit_logs for security forensics
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;
```

- [ ] **Step 2: Run in SQL Editor. Expected: "Success."**

- [ ] **Step 3: Create `lib/audit.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'
type ResourceType =
  | 'product' | 'category' | 'order' | 'enquiry'
  | 'banner' | 'setting' | 'profile'

interface AuditParams {
  action:        AuditAction
  resourceType:  ResourceType
  resourceId?:   string
  oldData?:      Record<string, unknown>
  newData?:      Record<string, unknown>
}

export async function logAuditEvent(params: AuditParams) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('audit_logs').insert({
    admin_id:      user.id,
    action:        params.action,
    resource_type: params.resourceType,
    resource_id:   params.resourceId,
    old_data:      params.oldData ?? null,
    new_data:      params.newData ?? null,
    user_agent:    typeof navigator !== 'undefined' ? navigator.userAgent : null,
  })
}
```

- [ ] **Step 4: Add audit logging to critical mutations**

In `services/products.ts`, wrap `createProduct`, `updateProduct`, `deleteProduct`:

```typescript
import { logAuditEvent } from '@/lib/audit'

export async function createProduct(product: ProductInsert) {
  // ... existing code to get `data` ...
  await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data })
  return data
}

export async function updateProduct(id: string, updates: ProductUpdate) {
  // ... existing code to get `data` ...
  await logAuditEvent({ action: 'UPDATE', resourceType: 'product', resourceId: id, newData: updates })
  return data
}

export async function deleteProduct(id: string) {
  // ... existing soft-delete code ...
  await logAuditEvent({ action: 'DELETE', resourceType: 'product', resourceId: id })
}
```

Apply the same pattern to `orders.ts` (status updates), `settings.ts`, and `banners.ts`.

- [ ] **Step 5: Verify audit log entries appear**

In Supabase → Table Editor → audit_logs: perform a product create action in the UI. Confirm a new row appears with the correct `admin_id`, `action`, `resource_type`, and `new_data`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/009_audit_log_enhancements.sql lib/audit.ts services/
git commit -m "feat: audit logging on all critical mutations with user agent"
```

---

### Task 34: GitHub Actions CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest

    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Tests
        run: npm run test:run

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Add Supabase secrets to GitHub repository**

Go to: GitHub → Repository → Settings → Secrets and variables → Actions → New secret

Add:
- `NEXT_PUBLIC_SUPABASE_URL` — staging project URL (not production)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — staging anon key

Use **staging** credentials in CI — never production.

- [ ] **Step 3: Push and verify the workflow runs**

```bash
git add .github/
git commit -m "ci: add GitHub Actions pipeline (lint, typecheck, tests, build)"
git push origin main
```

Go to GitHub → Actions tab and confirm the pipeline runs green.

- [ ] **Step 4: Verify the Actions badge**

Expected: all steps pass — Lint ✓, Type check ✓, Tests ✓, Build ✓.

---

### Task 35: Security Headers

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Read current `next.config.ts`**

Open `next.config.ts` and note the existing configuration.

- [ ] **Step 2: Add security headers**

```typescript
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // unsafe-eval needed for Next.js dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "font-src 'self' https://fonts.gstatic.com",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  // Add to existing config:
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 3: Test headers in browser**

```bash
npm run dev
```

Open DevTools → Network → select any request → Response Headers.
Verify: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` are present.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "security: add Content-Security-Policy and security headers"
```

---

### Task 36: Sentry Error Monitoring

**Files:**
- Modify: `app/layout.tsx`
- Create: `lib/monitoring.ts`

- [ ] **Step 1: Install Sentry**

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

The wizard creates `sentry.client.config.ts`, `sentry.server.config.ts`, and updates `next.config.ts`. Follow the prompts using your Sentry DSN.

- [ ] **Step 2: Create `lib/monitoring.ts` for app-level error capture**

```typescript
import * as Sentry from '@sentry/nextjs'
import type { AppError } from '@/lib/errors'

export function captureError(err: AppError | Error | unknown, context?: Record<string, string>) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error captured]', err, context)
    return
  }

  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v))
    }
    Sentry.captureException(err)
  })
}
```

- [ ] **Step 3: Add to TanStack Query global error handler**

In `providers/query-provider.tsx`, add a global error callback:

```typescript
import { captureError } from '@/lib/monitoring'

const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => captureError(error, { context: 'react-query' }),
  }),
  mutationCache: new MutationCache({
    onError: (error) => captureError(error, { context: 'react-query-mutation' }),
  }),
}))
```

Also import `QueryCache` and `MutationCache` from `@tanstack/react-query`.

- [ ] **Step 4: Commit**

```bash
git add sentry.*.config.ts lib/monitoring.ts providers/query-provider.tsx next.config.ts
git commit -m "feat: Sentry error monitoring with TanStack Query global error capture"
```

---

## Updated Implementation Checklist

### Phase 1 — Foundation
- [ ] Task 1: Dependencies + test setup
- [ ] Task 2: Environment variables
- [ ] Task 3: Supabase client utilities
- [ ] Task 4: Middleware (route protection)
- [ ] Task 5: Auth service + tests
- [ ] Task 6: Wire login page
- [ ] Task 7: Wire sign out

### Phase 2 — Database
- [ ] Task 8: Migration 001 — profiles
- [ ] Task 9: Migration 002 — categories + products
- [ ] Task 10: Migration 003 — orders
- [ ] Task 11: Migration 004 — enquiries + banners + settings
- [ ] Task 12: Migration 005 — RLS
- [ ] Task 13: Migration 006 — audit logs
- [ ] Task 14: TypeScript types

### Phase 3 — Module Integrations
- [ ] Task 15: TanStack Query provider + UI components
- [ ] Task 16: Products service + tests
- [ ] Task 17: Products hooks
- [ ] Task 18: Refactor products page
- [ ] Task 19: Storage + image upload
- [ ] Task 20: Categories module
- [ ] Task 21: Orders module
- [ ] Task 22: Enquiries module
- [ ] Task 23: Banners module
- [ ] Task 24: Settings module
- [ ] Task 25: Dashboard Server Component
- [ ] Task 26: Real-time orders
- [ ] Task 27: Fix category selector

### Phase 4 — Cleanup
- [ ] Task 28: Delete mockDb + cleanup
- [ ] Task 29: Type check + build

### Phase 5 — Production Hardening
- [ ] Task 30: Standardized error handling
- [ ] Task 31: Storage security policies + file validation
- [ ] Task 32: Performance indexes + trigram search
- [ ] Task 33: Enhanced audit logging
- [ ] Task 34: GitHub Actions CI/CD
- [ ] Task 35: Security headers
- [ ] Task 36: Sentry monitoring

---

## Production Readiness Checklist

Before deploying to production, verify every item:

### Security
- [ ] All RLS policies enabled and tested with `anon` role
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never in client-side code or git history
- [ ] Storage bucket policies in place (Task 31)
- [ ] Security headers added (Task 35)
- [ ] Admin user roles verified in `profiles` table
- [ ] Audit logs recording all critical actions (Task 33)

### Data Integrity
- [ ] All migrations run in order (001–009)
- [ ] No mock data remaining (`grep -r "mockDb"` returns 0 results)
- [ ] Soft deletes working (products/categories return `deleted_at IS NULL`)
- [ ] `updated_at` triggers firing on all relevant tables

### Reliability
- [ ] CI pipeline green on `main` branch (Task 34)
- [ ] Sentry DSN configured and receiving events (Task 36)
- [ ] Real-time replication enabled for `orders` table in Supabase dashboard
- [ ] All pages have loading, error, and empty states

### Performance
- [ ] Trigram extension enabled (`pg_trgm`)
- [ ] Compound indexes in place (Task 32)
- [ ] All queries paginated (no unbounded `SELECT *`)

### Operations
- [ ] Supabase automatic backups enabled (Dashboard → Database → Backups)
- [ ] Staging environment tested before production deploy
- [ ] `.env.production` uses production Supabase project credentials
- [ ] Production build passes: `npm run build`

---

## Architecture Reference

### Environment Strategy

| Environment | Supabase Project | Deployed To   |
|-------------|-----------------|---------------|
| Local       | Separate project or local CLI | `localhost:3000` |
| Staging     | Staging project  | Vercel preview |
| Production  | Production project | Vercel production |

Never run migrations directly on production without first testing on staging.

---

### Database Governance Rules

1. **Never edit existing migrations** — always create new ones.
2. **One concern per migration** — don't combine unrelated changes.
3. **Soft delete business entities** — use `deleted_at`, never `DELETE` for products/categories/customers.
4. **All tables need indexes** on foreign keys, filter columns, and sort columns.
5. **Append-only audit logs** — no `UPDATE` or `DELETE` policies on `audit_logs`.

---

### Role Expansion Roadmap

Current implementation supports `admin` and `super_admin`. Future expansion path:

| Role            | Permissions                          | When to Add              |
|-----------------|--------------------------------------|--------------------------|
| `content_admin` | products + categories + banners only | When team grows           |
| `support_admin` | enquiries read/write only            | When support team is hired |
| `finance_admin` | orders + payments read only          | When finance team is separate |
| `analytics_admin` | read-only across all tables        | When reporting team exists |

Add new roles by: (1) adding to the `admin_role` enum, (2) updating `is_admin()` helper, (3) adding targeted RLS policies, (4) updating middleware if needed.

---

### API Architecture Decision Guide

| Scenario | Use |
|----------|-----|
| Read product list | Direct Supabase query |
| Update order status | Direct Supabase query |
| Bulk update 100+ records | Edge Function |
| Send email notification | Edge Function |
| Webhook from payment provider | Edge Function |
| Generate PDF report | Edge Function |
| Scheduled cleanup job | Supabase Cron (Edge Function) |
| Validate complex business rules | Edge Function |

---

### Concurrency Risk Mitigation

For the current scale (small admin team, luxury goods), the risk of concurrent edits is low. When it becomes a concern:

1. Add `version_number INTEGER DEFAULT 1` to `products` and `orders`.
2. In update queries: `WHERE id = $id AND version_number = $expected_version`.
3. If 0 rows updated, return "Record modified by another admin — please refresh."

---

### Realtime Reliability Pattern

The implementation uses the **invalidate-and-refetch** pattern (not raw payload application):

```
Supabase Realtime event → invalidateQueries(['orders']) → TanStack Query refetches from DB
```

This prevents stale state from dropped events and duplicate processing. The canonical DB state always wins.

For reconnect handling, Supabase JS SDK reconnects automatically. The `useRealtimeOrders` hook in Task 26 tears down and recreates the channel on component unmount/remount, which handles React Strict Mode double-invocation correctly.

---

### Future Improvements (Phase 6+)

Prioritized by business impact:

| Feature | Priority | Effort |
|---------|----------|--------|
| Admin notifications (new orders, new enquiries) | High | Medium |
| Order timeline / status history | High | Low |
| Customer CRM view (order history per customer) | Medium | Medium |
| Analytics dashboard (charts, revenue trends) | Medium | High |
| Inventory / stock tracking | Medium | High |
| Email reply to enquiries via Supabase Edge Functions | Low | Medium |
| Advanced search with filters + saved views | Low | Medium |
| Export orders/products to CSV | Low | Low |
