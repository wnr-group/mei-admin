# Dynamic Category Loading for ProductForm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded category dropdown with dynamic loading from the database, eliminating the "Category not found" error.

**Architecture:** Load categories on component mount, store by ID in state, use IDs as dropdown values instead of category names.

**Tech Stack:** TypeScript, React 19, Next.js 16, Supabase JS client

---

## File Map

- Modify: `components/products/ProductForm.tsx` — replace hardcoded categories with dynamic loading

---

### Task 1: Refactor ProductForm to use dynamic category loading

**Files:**
- Modify: `components/products/ProductForm.tsx`

- [ ] **Step 1: Add the dynamic categories state and useEffect hook**

Find the existing state declarations (around line 32). After the `[category, setCategory]` line, add:

```typescript
const [dbCategories, setDbCategories] = useState<Category[]>([])
```

Then, after the existing `useEffect` for loading products (around line 57), add a new useEffect for loading categories:

```typescript
// Load available categories on mount
useEffect(() => {
  async function loadCategories() {
    try {
      const { categories } = await getCategories()
      setDbCategories(categories)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  loadCategories()
}, [])
```

- [ ] **Step 2: Update the category dropdown in the form**

Find the category dropdown (search for `CATEGORIES.map`). Replace:

```tsx
{CATEGORIES.map((cat) => (
  <option key={cat} value={cat}>
    {cat}
  </option>
))}
```

With:

```tsx
{dbCategories.map((cat) => (
  <option
    key={cat.id}
    value={cat.id}
  >
    {cat.name}
  </option>
))}
```

- [ ] **Step 3: Update the category loading in edit mode**

Find where the product is loaded (around line 83-85). Change:

```typescript
const cat = categories.find((c) => c.id === prod.category_id);
setCategory(cat?.name ?? '');
```

To:

```typescript
setCategory(prod.category_id ?? '')
```

Remove the extra `getCategories()` call in the edit load function if present.

- [ ] **Step 4: Remove the category matching/validation logic**

Find the save handler (`handleSubmit`, around line 201-224). Remove/delete:

```typescript
const normalize = (value: string) => value.trim().toLowerCase();

// TODO: Remove debug logs after category matching fix verification
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

- [ ] **Step 5: Update the category_id assignment in both create and edit flows**

In the save handler, change both:

```typescript
category_id: matchedCat.id,
```

To:

```typescript
category_id: category,
```

(The `category` state now holds the ID directly, not the name)

- [ ] **Step 6: Verify and clean up**

Remove the hardcoded `CATEGORIES` constant at the top of the file (line 11):

```typescript
const CATEGORIES = ['Bridal Lehengas', 'Sarees', 'Evening Gowns', 'Couture', 'Suits'];
```

Keep `WORK_TYPES` unchanged.

- [ ] **Step 7: Run tests to ensure no regressions**

```bash
npm test -- __tests__/services/products.test.ts --run
```

Expected: All 24 product tests pass (slug collision tests unaffected).

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: Zero errors. (Category type should be imported from @/types)

- [ ] **Step 9: Commit the changes**

```bash
git add components/products/ProductForm.tsx
git commit -m "refactor: load categories dynamically from database instead of hardcoded list"
```

---

## Success Criteria

- ✅ Categories load dynamically from database on component mount
- ✅ Dropdown displays category names but stores IDs as values
- ✅ New product creation succeeds with selected category (no "Category not found" error)
- ✅ Editing existing products works correctly (category loads by ID)
- ✅ No hardcoded CATEGORIES dependency remains
- ✅ All 24 product slug tests continue passing (MEI-28 unaffected)
- ✅ No UI regression
- ✅ Type-check clean
- ✅ createProduct and updateProduct service calls unchanged
