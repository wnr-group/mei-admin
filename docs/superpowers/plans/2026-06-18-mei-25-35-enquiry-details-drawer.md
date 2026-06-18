# MEI-25/MEI-35 Admin Enquiry Details — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render occasion, budget, measurements, and reference images inside the Admin Enquiry Details drawer — a UI-only change to two files.

**Architecture:** `getEnquiries` already uses `select('*')` so all DB columns are fetched. `occasion` and `budget` are in the TypeScript type. `measurements` and `reference_images` exist in the live DB but are absent from the TypeScript type — Task 1 confirms the payload, Task 2 adds the types if needed, Task 3 adds the four UI sections and scroll support.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript strict, Supabase, Vitest

---

## Codebase facts — do not re-verify

| Fact | Location |
|---|---|
| `select('*')` fetches all columns | `services/enquiries.ts:22` |
| Existing diagnostic log | `services/enquiries.ts:34` — `console.log('[AdminEnquiries] raw response', ...)` |
| `occasion: string \| null` and `budget: string \| null` exist in Row | `types/database.ts:48` |
| `measurements` and `reference_images` **absent** from Row type | `types/database.ts:47-51` |
| `Json` type exported | `types/database.ts:1-7` |
| Project uses `<img>` tags, not `next/image` | Confirmed by grep — `next/image` not used in app components |
| Drawer location | `app/(app)/enquiries/page.tsx:252-338` |
| Drawer currently shows | Name, Email, Phone, Message, Reply form |
| Confirmed measurements shape | `{ "bust":"34", "waist":"28", "hip":"38", "shoulder":"15", "length":"58", "sleeve":"10" }` — all string values |
| Confirmed reference_images shape | Array of Supabase Storage URL strings |

## Allowed files

| File | Change |
|---|---|
| `types/database.ts:48-49` | Add `measurements: Json \| null` and `reference_images: Json \| null` to Row and Insert |
| `app/(app)/enquiries/page.tsx:260,293` | Add `overflow-y-auto` to panel div; insert four sections after Message |

## Forbidden files — do not touch

`services/enquiries.ts` · `hooks/use-enquiries.ts` · `supabase/*` · any migration · storefront · upload logic · reply/close/delete handlers

---

## Task 1: Verify the live payload before touching code

**Files:** None — read-only observation.

The diagnostic log at `services/enquiries.ts:34` already prints the full Supabase response to the browser console on every page load. Use it.

- [ ] **Step 1: Start the dev server**

```powershell
npm run dev
```

Expected: `Ready on http://localhost:3000`

- [ ] **Step 2: Open the admin enquiries page**

Navigate to `http://localhost:3000/enquiries`. Log in if redirected.

- [ ] **Step 3: Read the console output**

Open DevTools → Console. Find:
```
[AdminEnquiries] raw response { "data": [...], "error": null, "count": N }
```

Expand the first object inside `data`. Look for these keys: `occasion`, `budget`, `measurements`, `reference_images`.

- [ ] **Step 4: Choose a branch**

**Branch A — all four keys are present in the payload:**
→ Proceed to Task 2.

**Branch B — `measurements` or `reference_images` are absent:**
→ The query is returning all columns via `select('*')`. If a column is absent, it doesn't exist in the DB yet, which contradicts the verified facts. STOP. Do not modify any code. Report the discrepancy before proceeding.

---

## Task 2: Add missing fields to TypeScript type

**Execute only if Task 1 confirmed Branch A.**

**Files:**
- Modify: `types/database.ts:48-49`

- [ ] **Step 1: Locate the enquiries block in `types/database.ts`**

Find lines 47–51:
```ts
      enquiries: {
        Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null; deleted_at?: string | null }
      }
```

- [ ] **Step 2: Replace the enquiries block with the updated version**

```ts
      enquiries: {
        Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; measurements: Json | null; reference_images: Json | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; measurements?: Json | null; reference_images?: Json | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null; deleted_at?: string | null }
      }
```

`Json` is already defined and exported at `types/database.ts:1-7` — no import needed.

- [ ] **Step 3: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors. The Row type is widened — no existing field access changes.

---

## Task 3: Update the drawer UI

**Files:**
- Modify: `app/(app)/enquiries/page.tsx`

Two changes in this task: (a) make panel scrollable, (b) insert four new sections.

### 3a — Make the panel scrollable

- [ ] **Step 1: Locate the drawer panel div (line ~260)**

Find:
```tsx
          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col justify-between py-10 px-8 animate-slide-in border-l border-[#E8E0D5]">
```

- [ ] **Step 2: Remove `justify-between`, add `overflow-y-auto`**

Replace with:
```tsx
          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col overflow-y-auto py-10 px-8 animate-slide-in border-l border-[#E8E0D5]">
```

Width (`max-w-[480px]`), animation (`animate-slide-in`), positioning (`fixed inset-0`), and border are unchanged. `justify-between` is removed because it fights the scroll container.

### 3b — Insert the four new sections

- [ ] **Step 3: Locate the Message section (line ~293)**

Find this exact block:
```tsx
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Message</p>
                  <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.message}</p>
                </div>

                {/* Reply Form */}
```

- [ ] **Step 4: Replace it with Message + four new sections**

```tsx
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Message</p>
                  <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.message}</p>
                </div>

                {selectedEnquiry.occasion && (
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Occasion</p>
                    <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.occasion}</p>
                  </div>
                )}

                {selectedEnquiry.budget && (
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Budget Range</p>
                    <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.budget}</p>
                  </div>
                )}

                {selectedEnquiry.measurements != null &&
                  typeof selectedEnquiry.measurements === 'object' &&
                  !Array.isArray(selectedEnquiry.measurements) && (
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Measurements</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1.5">
                      {(['bust', 'waist', 'hip', 'shoulder', 'length', 'sleeve'] as const).map((key) => {
                        const val = (selectedEnquiry.measurements as Record<string, unknown>)[key]
                        if (val == null) return null
                        return (
                          <div key={key} className="flex justify-between text-[12px]">
                            <span className="capitalize text-zinc-400">{key}</span>
                            <span className="text-zinc-800">{String(val)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {Array.isArray(selectedEnquiry.reference_images) &&
                  (selectedEnquiry.reference_images as string[]).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Reference Images</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(selectedEnquiry.reference_images as string[]).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-[72px] h-[72px] border border-[#E8E0D5] overflow-hidden bg-zinc-100 flex-shrink-0 hover:border-[#B38B5D] transition-colors"
                        >
                          <img
                            src={url}
                            alt={`Reference ${i + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply Form */}
```

Implementation notes:
- Occasion and Budget: hidden if null or empty string (falsy check covers both)
- Measurements: `!= null` + `typeof === 'object'` + `!Array.isArray` guards against null, string, and array payloads before key access
- `String(val)` renders both string and numeric values — DB stores `"34"` as string, this is fine
- Reference Images: `Array.isArray` guard + length check — hidden if empty
- `<img onError>` sets `display: 'none'` on broken images — no crash, no console error
- Thumbnails use `<a target="_blank">` — opens Supabase URL in new tab, read-only, no data mutation
- Typography classes (`text-[10px] font-bold tracking-widest text-zinc-400 uppercase` / `text-[13px] text-zinc-800 mt-1`) match existing Name/Email/Phone/Message sections exactly

- [ ] **Step 5: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

If this errors with `Property 'measurements' does not exist on type 'Enquiry'`, Task 1 was Branch B (columns absent). In that case still update `types/database.ts` per Task 2 (the type describes what the DB has — it does not create columns) and re-run. 0 errors required before continuing.

- [ ] **Step 6: Commit**

```powershell
git add "app/(app)/enquiries/page.tsx" types/database.ts
git commit -m "feat(enquiries): display occasion, budget, measurements, and reference images in drawer"
```

---

## Task 4: Code quality gates

**Files:** No changes — commands only.

- [ ] **Step 1: Lint**

```powershell
npm run lint
```

Expected: 0 errors. If warnings appear on unrelated files, ignore them. Fix any error on `page.tsx` or `database.ts`.

- [ ] **Step 2: Type check**

```powershell
npx tsc --noEmit
```

Expected: silent (0 errors = no output).

- [ ] **Step 3: Tests**

```powershell
npx vitest run
```

Expected: all existing tests pass. No service code was touched so `__tests__/services/enquiries.test.ts` must pass unchanged.

---

## Task 5: Manual regression and data verification

**Files:** No changes — browser observation only.

### Regression checks

- [ ] **Step 1: Enquiries list loads**

Navigate to `http://localhost:3000/enquiries`. Confirm rows appear and footer shows entry count.

- [ ] **Step 2: Status filter tabs**

Click ALL → NEW → REPLIED → CLOSED in sequence. Table must reload for each tab.

- [ ] **Step 3: Pagination**

If total > 6 rows, PREV/NEXT and page number buttons must work.

- [ ] **Step 4: Drawer opens and closes**

Click VIEW on any row. Drawer slides in. Click X — closes. Click backdrop — closes.

- [ ] **Step 5: Reply workflow**

Open a NEW enquiry. Enter text in the reply box. Click Send Reply. Row status must change to REPLIED. No console errors.

- [ ] **Step 6: Close workflow**

Open a REPLIED enquiry. Click Close. Row status must change to CLOSED. No console errors.

- [ ] **Step 7: Delete workflow**

Click DELETE on any row. Confirm the dialog. Row disappears. No console errors.

### Real data verification — Priya Sharma

- [ ] **Step 8: Locate Priya Sharma's enquiry**

Use the ALL tab. Find `priya.sharma.mei.testing@gmail.com`.

- [ ] **Step 9: Open drawer and verify all sections**

| Section | Expected |
|---|---|
| NAME | Priya Sharma |
| EMAIL | priya.sharma.mei.testing@gmail.com |
| PHONE | submitted phone number or `-` |
| MESSAGE | submitted message |
| OCCASION | submitted occasion value (absent if null) |
| BUDGET RANGE | submitted budget value (absent if null) |
| MEASUREMENTS | 2-col grid: Bust 34, Waist 28, Hip 38, Shoulder 15, Length 58, Sleeve 10 |
| REFERENCE IMAGES | row of 72×72 thumbnails |

- [ ] **Step 10: Test every thumbnail**

Click each thumbnail. Expected for each:
- New browser tab opens
- Image loads from a `supabase.co/storage/v1/object/public/enquiry-images/…` URL
- No 404, no console error

- [ ] **Step 11: Verify drawer scrolls**

If measurements + reference images make content taller than the viewport, the panel must scroll vertically.

- [ ] **Step 12: Check browser console**

DevTools → Console must show 0 errors, 0 React warnings related to the drawer.

---

## Non-goals

Do not touch: `services/enquiries.ts` · `hooks/use-enquiries.ts` · any migration · storefront · upload logic · reply/close/delete handlers · filter/pagination logic · list table layout · `app/(app)/enquiries/[id]/page.tsx` (legacy mock-data page)

---

## Completion gate

Mark DONE only when every item below is verified:

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 errors
- [ ] `npx vitest run` → all pass
- [ ] Occasion displays in drawer when non-null
- [ ] Budget Range displays in drawer when non-null
- [ ] Measurements grid displays correctly (Bust 34 / Waist 28 / Hip 38 / Shoulder 15 / Length 58 / Sleeve 10)
- [ ] Reference image thumbnails display and click-open in new tab
- [ ] Broken images hidden gracefully (no crash)
- [ ] Drawer scrolls vertically without layout breaks
- [ ] Reply / Close / Delete workflows unchanged
- [ ] Status filters (ALL / NEW / REPLIED / CLOSED) unchanged
- [ ] Pagination unchanged
- [ ] 0 browser console errors
- [ ] Only `app/(app)/enquiries/page.tsx` and `types/database.ts` modified
