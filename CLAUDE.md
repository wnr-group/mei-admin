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

## Conventions

- Use `'use client'` only when component needs hooks/interactivity
- Route groups with `(parentheses)` for layout boundaries
- Keep API/data fetching in Server Components
- Tailwind utility classes inline; no CSS modules
- No dark mode in admin (light-only)
