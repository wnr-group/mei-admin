# MEI-33 Admin Enquiries Not Displaying — Surgical Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify and surgically fix why the admin enquiries page shows "No enquiries yet." when rows with `status = NEW` exist in Supabase.

**Architecture:** The data flow is `useEnquiries hook → getEnquiries service → createBrowserClient → Supabase (anon key + auth session) → RLS: is_admin()`. The query code is correct; the failure is silent (returns 0 rows, not an error), which means either the wrong project is queried or RLS is filtering out results due to a session/profile issue.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr` (createBrowserClient), TypeScript, Vitest

---

## What the code says (read before touching anything)

**Files already read — do not re-read to start:**

| File | Role |
|---|---|
| `services/enquiries.ts:13-31` | `getEnquiries` — `.from('enquiries').select('*', { count: 'exact' }).is('deleted_at', null).order(…).range(…)` — no wrong status filter; status filter is conditional and defaults to `null` (no filter) |
| `hooks/use-enquiries.ts:8-13` | `useEnquiries` — `useQuery` wrapping `getEnquiries`; passes `options` from page |
| `app/(app)/enquiries/page.tsx:15-16` | Initial state: `selectedStatus = null` → hook called with `{ page: 1, limit: 6, status: undefined }` — no status filter applied |
| `app/(app)/enquiries/page.tsx:30-31` | Error renders `<ErrorState>`, not `<EmptyState>` — so query is **succeeding** but returning 0 rows |
| `lib/supabase/client.ts` | `createBrowserClient` using `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `supabase/migrations/005_rls_policies.sql:71-74` | RLS: `"Admins manage enquiries" FOR ALL USING (public.is_admin())` — requires authenticated admin in `profiles` table |
| `supabase/migrations/20260616153000_orders_enquiries_soft_delete.sql` | Confirms `deleted_at` column exists on `enquiries` — migration was applied |

**Key diagnostic clues:**
- Query returns 0 rows (not an error) → column exists, syntax is correct
- RLS silently returns 0 rows when the authenticated user doesn't pass `is_admin()`
- No `middleware.ts` exists → no automatic session refresh between requests
- Two possible root causes: (A) wrong Supabase project in `.env.local`, (B) admin user not in `profiles` table with correct role

---

## File structure (read-only unless a fix is required)

- **Read only:** `services/enquiries.ts`, `hooks/use-enquiries.ts`, `app/(app)/enquiries/page.tsx`
- **Potentially modify:** `services/enquiries.ts` — only if query has a wrong filter (unlikely based on code review)
- **No new files**

---

## Task 1: Add diagnostic logging to capture the raw Supabase response

**Files:**
- Modify (temporarily): `services/enquiries.ts`

- [ ] **Step 1: Open `services/enquiries.ts` and find the query result**

```ts
// Line 28 in services/enquiries.ts — this is what you are looking for:
const { data, error, count } = await query
```

- [ ] **Step 2: Add a console.log immediately after line 28**

Replace:
```ts
const { data, error, count } = await query

if (error) throw toAppError(new Error(error.message))
```

With:
```ts
const { data, error, count } = await query
console.log('[AdminEnquiries] raw response:', JSON.stringify({ data, error, count }))

if (error) throw toAppError(new Error(error.message))
```

- [ ] **Step 3: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 4: Open the admin enquiries page in the browser**

Navigate to `http://localhost:3000/enquiries`

- [ ] **Step 5: Open DevTools → Console tab**

Look for the line starting with `[AdminEnquiries] raw response:`.

**Record what you see.** Use the decision tree in Task 3.

---

## Task 2: Verify the Supabase project URLs match

**Files:** `.env.local` (admin), `../mei/.env.local` or `../mei/.env` (storefront)

The storefront and admin MUST point to the same Supabase project URL. Many blank-list issues come from storefront writing to Project A while admin reads from Project B.

- [ ] **Step 1: Read the admin Supabase URL**

Already known from `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://hjhqemsyufsifmgespur.supabase.co
```

- [ ] **Step 2: Find the storefront's Supabase URL**

```bash
# Run from the admin directory — adjust path if storefront lives elsewhere
cat ../mei/.env.local 2>/dev/null || cat ../mei/.env 2>/dev/null || echo "NOT FOUND"
```

- [ ] **Step 3: Compare**

They must be identical. If they differ, that is the root cause — go to Task 4, Fix D.

If they match, continue to Task 3.

---

## Task 3: Identify root cause from console output

Run through this decision tree using the console output from Task 1:

### Branch A — `data: null`, `error: { message: "..." }`

The service throws before `EmptyState` renders, so the page would show `ErrorState`. If you see this, the symptoms described in the bug report are wrong — the page IS showing an error.

→ Read the error message. Fix that specific error. Do not proceed with this plan.

---

### Branch B — `data: []`, `error: null`, `count: 0`

The query succeeded but returned 0 rows. This means one of:

**B1 — RLS blocking:** The auth session is not being recognized as an admin.
- Confirm: Open the Supabase dashboard → Authentication → Users → find your logged-in email
- Then: Table Editor → `profiles` → filter by that user's `id`
- Expected: a row with `role = 'admin'` or `role = 'super_admin'`
- If the row is MISSING → go to Task 4, Fix B (insert profile row)
- If the row EXISTS → the session might not be carrying the auth token to the browser client. Check DevTools → Application → Cookies → look for `sb-hjhqemsyufsifmgespur-auth-token`. If absent, the session is not persisted → go to Task 4, Fix C.

**B2 — Wrong project:** If URLs differed in Task 2 → go to Task 4, Fix D.

---

### Branch C — `data: [{ id: "...", name: "...", ... }]`, `count: 1+`

The query IS returning rows. The bug is in rendering, not data fetching.
→ Go to Task 4, Fix E.

---

## Task 4: Apply the surgical fix

**Apply ONLY the fix that matches your root cause from Task 3. Do not apply multiple fixes.**

---

### Fix B — Missing admin profile row

The authenticated user has no row in `profiles`, so `is_admin()` returns false and RLS returns 0 rows.

**Where to fix:** Supabase dashboard (no code change needed).

- [ ] **Step 1: Open Supabase dashboard → Table Editor → profiles**

- [ ] **Step 2: Insert a row for the admin user**

```sql
INSERT INTO public.profiles (id, role, full_name)
VALUES (
  '<your-auth-user-uuid>',   -- from Authentication → Users page
  'admin',
  'Admin'
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

Run this in Supabase → SQL Editor.

- [ ] **Step 3: Reload the admin enquiries page**

Expected: enquiry from `vaishnavi@gmail.com` appears in the list.

---

### Fix C — Auth session not persisted to browser client

The admin is "logged in" but the session token is not being stored in browser cookies, so `createBrowserClient` queries as unauthenticated.

**Where to check:** Supabase `createBrowserClient` reads from `localStorage` key `sb-<project-ref>-auth-token` in addition to cookies. The auth guard (commit `b01fb05`) uses the server client and may be using a different session than the browser client.

- [ ] **Step 1: Open DevTools → Application → Local Storage → `http://localhost:3000`**

Look for a key like `sb-hjhqemsyufsifmgespur-auth-token`.

- [ ] **Step 2: If the key is absent**

Log out and log back in via `/login` to force the browser client to store the session.

- [ ] **Step 3: If key present but query still returns 0 rows**

Check DevTools → Network → find the `enquiries?select=*` request → Headers → look for `Authorization: Bearer <token>`. If absent, the browser client is not attaching the auth header.

In that case, open `services/enquiries.ts` and change `createClient` import to use the server client pattern by passing it as a parameter, or confirm the login flow properly stores the session before the query runs.

---

### Fix D — Wrong Supabase project in .env.local

The admin is pointing to a different Supabase project than the storefront.

- [ ] **Step 1: Copy the correct URL and anon key from the storefront's `.env.local`**

- [ ] **Step 2: Update `admin/.env.local`**

Replace:
```
NEXT_PUBLIC_SUPABASE_URL=https://hjhqemsyufsifmgespur.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<current value>
```

With the matching values from the storefront.

- [ ] **Step 3: Restart the dev server**

```bash
# Ctrl+C to stop, then:
npm run dev
```

- [ ] **Step 4: Reload enquiries page — verify the enquiry is visible**

---

### Fix E — Rendering bug (data returns rows but UI shows empty)

Only apply if Task 3 Branch C confirmed data IS returning rows.

- [ ] **Step 1: Open `app/(app)/enquiries/page.tsx`**

Look at line 21:
```ts
const enquiries = data?.enquiries ?? []
```

- [ ] **Step 2: Add a console.log above line 67**

```ts
console.log('[EnquiriesPage] enquiries:', enquiries.length, enquiries)
if (enquiries.length === 0) return <EmptyState message="No enquiries yet." />
```

- [ ] **Step 3: Check the console and identify which field is undefined or mismatched**

Fix only the specific field access that is wrong.

---

## Task 5: Remove diagnostic logs and verify

- [ ] **Step 1: Remove the console.log from `services/enquiries.ts`**

Revert lines added in Task 1, Step 2 — restore original:
```ts
const { data, error, count } = await query

if (error) throw toAppError(new Error(error.message))
```

- [ ] **Step 2: Remove any console.log added in Task 4 Fix E**

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
npx vitest run
```

Expected: all pass. No tests should have changed — we made no logic changes.

---

## Task 6: End-to-end verification

- [ ] **Step 1: Open the admin enquiries page**

Navigate to `http://localhost:3000/enquiries`.

Expected: The enquiry from `vaishnavi@gmail.com` is visible in the table with:
- Name column: the submitted name
- Email column: `vaishnavi@gmail.com`
- Status badge: `NEW`

- [ ] **Step 2: Click REPLY on the enquiry**

Expected: Side panel opens showing:
- Name
- Email
- Phone (or `-`)
- Message
- Reply textarea

- [ ] **Step 3: Verify status filter tabs work**

Click `NEW` tab → enquiry still visible.
Click `REPLIED` tab → enquiry absent (status is NEW).
Click `ALL` tab → enquiry visible again.

- [ ] **Step 4: Verify no regressions on other admin pages**

Open each of these and confirm they still load:
- `/dashboard`
- `/products`
- `/categories` (or equivalent)
- `/orders`
- `/banners`
- `/settings`

---

## Non-goals (do not touch)

- RLS policies (only INSERT-level policy might be missing for storefront, but that's already working)
- Supabase schema
- Any migration files
- Storefront code
- Admin UI layout, navigation, or design
- Any page other than enquiries

---

## Completion gate

Mark done only when ALL of these are true:

- [ ] Enquiry from `vaishnavi@gmail.com` visible in admin list
- [ ] Side panel shows correct fields
- [ ] Status filter tabs work
- [ ] `npm run lint` → 0 errors
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx vitest run` → all pass
- [ ] No diagnostic console.logs remain in production code
- [ ] Dashboard, Products, Categories, Orders, Banners, Settings still load
