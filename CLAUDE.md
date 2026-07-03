@AGENTS.md

# MEI Bridal Couture — Admin Panel

## Project Overview

Admin dashboard for MEI Bridal Couture e-commerce platform. Manages products, categories, orders, enquiries, banners, and settings for the storefront at `../mei`.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, React Compiler)
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme inline` in globals.css)
- **Icons:** lucide-react
- **Language:** TypeScript (strict)

## Architecture

```
app/
  layout.tsx          # Root layout (fonts, global CSS)
  page.tsx            # Landing/redirect
  login/page.tsx      # Auth page
  (app)/              # Authenticated route group
    layout.tsx        # Sidebar + TopBar shell
    dashboard/        # Overview stats
    products/         # CRUD for products
components/
  layout/             # Sidebar.tsx, TopBar.tsx
```

## Design System

- Light theme: white/cream background (`#faf8f5`), gold accents (`#c9a465`)
- Font: Inter (body), Cormorant Garamond (display/headings)
- Compact nav: 11px uppercase tracking-widest labels
- Active state: left gold border + warm background tint

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
npx tsc --noEmit  # Type check
```

**Never deploy test-expedite-retry to production:**

```bash
# Safe: deploy specific functions by name
npx supabase functions deploy create-order
npx supabase functions deploy notification-worker

# NEVER run this — deploys all functions including test-expedite-retry:
# npx supabase functions deploy  (no args)
```

## Local Development Setup

**Critical:** For local development to work correctly, `.env.local` must point to the **hosted Supabase project**, not the local Docker instance. This ensures:
- Storefront and admin query the same database (hosted)
- create-order Edge Function finds products
- Payment callbacks work correctly

**Required `.env.local` entries:**
```bash
# Admin panel browser client — MUST point to hosted Supabase, not local Docker
# Without this, the browser gets "permission denied for table orders" (local DB has no data/grants)
NEXT_PUBLIC_SUPABASE_URL=https://hjhqemsyufsifmgespur.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHFlbXN5dWZzaWZtZ2VzcHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTYzMDksImV4cCI6MjA5NjU3MjMwOX0.C3q3hCrcbdKxDmvCpEzAZ4sO3AKXXdfAVE6fq4E7M_g

# Edge Function client — also points to hosted Supabase
MEI_DB_URL=https://hjhqemsyufsifmgespur.supabase.co
MEI_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHFlbXN5dWZzaWZtZ2VzcHVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk5NjMwOSwiZXhwIjoyMDk2NTcyMzA5fQ.-FRJZIPq-hpfstKY2vZvahztAa0ZEv2-QSSpiEy591o
```

**Why:** Two separate clients need the hosted URL:
1. **Browser client** (`NEXT_PUBLIC_SUPABASE_URL`): Used by the admin panel UI. `.env` defaults to `http://127.0.0.1:54321` (local Docker). If `.env.local` doesn't override this, the browser queries the empty local database → "permission denied for table orders".
2. **Edge Function** (`MEI_DB_URL`): The `create-order` Edge Function checks `MEI_DB_URL` first, then falls back to `SUPABASE_URL`. Without `MEI_DB_URL`, it queries the empty local Docker database and fails with PRODUCT_NOT_FOUND.

## Conventions

- Use `'use client'` only when component needs hooks/interactivity
- Route groups with `(parentheses)` for layout boundaries
- Keep API/data fetching in Server Components
- Tailwind utility classes inline; no CSS modules
- No dark mode in admin (light-only)
