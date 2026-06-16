# Auth Route Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block unauthenticated users from all `(app)` routes by adding a Next.js 16 proxy (server-side session check via Supabase SSR).

**Architecture:** A `proxy.ts` file at the project root intercepts every request before rendering. For any path that isn't `/login` or `/`, it calls `supabase.auth.getUser()` (which validates the JWT against the Supabase auth server) and redirects to `/login` if no user is returned. A thin helper in `lib/supabase/proxy.ts` wires up the Supabase `createServerClient` to the proxy's `NextRequest`/`NextResponse` cookies — needed because `next/headers` is not available in proxy context.

**Tech Stack:** Next.js 16 (`proxy.ts` file convention), `@supabase/ssr` v0.12.0 (`createServerClient`), TypeScript strict.

---

## Critical Next.js 16 note

`middleware.ts` is **deprecated** in Next.js 16 and renamed to `proxy.ts`. The exported function must be named `proxy` (not `middleware` or `default`). See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` for full reference.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/supabase/proxy.ts` | Factory: `createServerClient` wired to `NextRequest`/`NextResponse` cookies |
| Create | `proxy.ts` | Auth guard: check Supabase session, redirect unauthenticated users to `/login` |

No existing files need modification.

---

### Task 1: Create proxy-compatible Supabase client

**Files:**
- Create: `lib/supabase/proxy.ts`

Background: `lib/supabase/server.ts` uses `cookies()` from `next/headers`, which throws in proxy context because it runs before the request enters the RSC rendering pipeline. The proxy receives `NextRequest` and `NextResponse` directly, so we must read/write cookies from those objects instead.

- [ ] **Step 1: Create `lib/supabase/proxy.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

export function createProxyClient(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 2: Type-check the new file**

Run: `npx tsc --noEmit`

Expected: No errors. If there are errors about `Database` type, check `types/database.ts` exists — it is imported the same way in `lib/supabase/server.ts` so it must already exist.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/proxy.ts
git commit -m "feat: add proxy-compatible Supabase client factory"
```

---

### Task 2: Create `proxy.ts` auth guard

**Files:**
- Create: `proxy.ts` (project root — same level as `app/`, `package.json`)

- [ ] **Step 1: Create `proxy.ts`**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createProxyClient } from '@/lib/supabase/proxy'

const PUBLIC_PATHS = ['/', '/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  if (PUBLIC_PATHS.includes(pathname)) {
    return response
  }

  const supabase = createProxyClient(request, response)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

Key decisions:
- `getUser()` (not `getSession()`) makes a network round-trip to Supabase auth to validate the JWT — this is the secure, server-side check the spec requires.
- `PUBLIC_PATHS` uses exact match so `/login/foo` (non-existent) would still get checked. This is intentional for a single-page login.
- The matcher excludes static assets and image optimisation paths to avoid Supabase network calls on every font/image load.
- `NextResponse.next({ request: { headers: request.headers } })` passes request headers through for RSC — required per Next.js proxy docs.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: No errors or warnings related to the new files.

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "feat: add auth route guard via Next.js 16 proxy"
```

---

### Task 3: Manual browser verification

Start the dev server and verify both acceptance criteria.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Wait for: `▲ Next.js 16.x.x` ready on `http://localhost:3000`

- [ ] **Step 2: Verify unauthenticated redirect (AC1)**

1. Open a private/incognito browser window (ensures no session cookies).
2. Navigate directly to `http://localhost:3000/dashboard`.

Expected: Browser immediately redirects to `http://localhost:3000/login`. The dashboard content never renders.

Repeat for `http://localhost:3000/products`. Same redirect expected.

- [ ] **Step 3: Verify authenticated passthrough (AC2)**

1. From the login page, sign in with valid admin credentials.
2. After successful login, navigate to `http://localhost:3000/products`.

Expected: Products page renders normally. No redirect. No visible delay beyond normal page load.

- [ ] **Step 4: Verify session check is server-side (AC3)**

1. While logged in, open DevTools → Network tab.
2. Navigate to `http://localhost:3000/dashboard`.
3. Inspect the initial document request (the HTML response, not a fetch).

Expected: The server responds with a 200 and the dashboard HTML — not a 302. This confirms the session check happens before the page renders, not as a client-side redirect after loading. (A client-side redirect would show a 200 with empty/loading HTML first, then a second 302 fetch request.)

- [ ] **Step 5: Commit if no issues**

No code changes expected in this task. If you found and fixed bugs, commit those separately with a descriptive message.
