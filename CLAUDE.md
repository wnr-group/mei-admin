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

## Local Development Setup

**Critical:** For local development to work correctly, `.env.local` must point to the **hosted Supabase project**, not the local Docker instance. This ensures:
- Storefront and admin query the same database (hosted)
- create-order Edge Function finds products
- Payment callbacks work correctly

**Required `.env.local` entries:**
```bash
# Points to hosted Supabase (DO NOT use local Docker URL)
MEI_DB_URL=https://hjhqemsyufsifmgespur.supabase.co
MEI_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHFlbXN5dWZzaWZtZ2VzcHVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk5NjMwOSwiZXhwIjoyMDk2NTcyMzA5fQ.-FRJZIPq-hpfstKY2vZvahztAa0ZEv2-QSSpiEy591o
```

**Why:** The `create-order` Edge Function checks `MEI_DB_URL` first (line 134), then falls back to `SUPABASE_URL`. Without `MEI_DB_URL`, it queries the empty local Docker database and fails with PRODUCT_NOT_FOUND.

## Conventions

- Use `'use client'` only when component needs hooks/interactivity
- Route groups with `(parentheses)` for layout boundaries
- Keep API/data fetching in Server Components
- Tailwind utility classes inline; no CSS modules
- No dark mode in admin (light-only)
