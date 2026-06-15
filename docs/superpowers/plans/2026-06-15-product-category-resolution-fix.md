# Product Category Resolution Bug Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "Category not found. Please refresh and try again." error when creating a product, caused by exact string comparison failing on whitespace or case differences.

**Architecture:** Replace the exact string comparison in ProductForm.tsx line 204 with a case-insensitive, whitespace-trimmed comparison. Add temporary debug logging to verify the fix.

**Tech Stack:** TypeScript, React, Next.js 16, ESLint

**Scope:** Minimal change to ONLY the category matching logic. NO changes to:
- Product create/edit flow
- Image upload flow
- Slug generation or collision handling (MEI-28)
- Work type selection
- UI/styling
- Routes or database schema
- Services (createProduct, updateProduct, getCategories)
- Existing tests

---

## File Map

- Modify: `components/products/ProductForm.tsx` — replace category matching logic at line 204, add debug logging

---

### Task 1: Fix category matching logic in ProductForm.tsx

**Files:**
- Modify: `components/products/ProductForm.tsx` (lines 200-210)

- [ ] **Step 1: Locate the category matching code**

Open `components/products/ProductForm.tsx`. Find the save handler (handleSubmit function) where category matching occurs around line 204:

```typescript
const matchedCat = categories.find((c) => c.name === category);
if (!matchedCat) {
  alert('Category not found. Please refresh and try again.');
  setIsSaving(false);
  return;
}
```

- [ ] **Step 2: Add normalize function and update the matching logic**

Replace the category matching section (lines 204-209) with:

```typescript
const normalize = (value: string) => value.trim().toLowerCase();

console.log('Selected category:', category);
console.log(
  'Available categories:',
  categories.map((c) => ({
    id: c.id,
    name: c.name,
  }))
);

const matchedCat = categories.find(
  (c) => normalize(c.name) === normalize(category)
);
if (!matchedCat) {
  alert('Category not found. Please refresh and try again.');
  setIsSaving(false);
  return;
}
```

This:
- Defines `normalize()` to trim and lowercase strings for case-insensitive, whitespace-robust comparison
- Adds console logging (temporary, for verification) to show selected category and available categories
- Uses normalized comparison in the find() call

- [ ] **Step 3: Verify the change**

Confirm the file now shows:
- `normalize()` function defined above the matching logic
- Console logging before the find() call
- `find()` uses normalized comparison: `normalize(c.name) === normalize(category)`
- The alert message and early return remain unchanged

- [ ] **Step 4: Run existing tests to ensure no regressions**

```bash
npm test -- __tests__/services/products.test.ts --run
```

Expected: All 24 product tests pass (no changes to service layer or tests).

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 6: Commit the fix**

```bash
git add components/products/ProductForm.tsx
git commit -m "fix: use case-insensitive category matching in product form"
```

---

## Success Criteria

- ✅ Product creation succeeds when selecting a category
- ✅ Console logs show the selected category and available categories
- ✅ No "Category not found" error appears (unless genuinely no match)
- ✅ Existing UI unchanged
- ✅ Existing tests continue passing
- ✅ No service-layer changes
- ✅ No schema/database changes
- ✅ No regressions in other flows (edit, image upload, slugs, work types)
