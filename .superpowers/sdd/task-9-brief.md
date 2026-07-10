### Task 9: Embed the Conditions panel in the category edit page

**Files:**
- Modify: `app/(app)/categories/add/page.tsx`

**Interfaces:**
- Consumes: `RuleList` from `@/components/categories/rules/RuleList` (Task 8); `CategoryMatchType` from `@/types`.

- [ ] **Step 1: Add `rule_match_type` state and load it from the category**

In `app/(app)/categories/add/page.tsx`, add the import:

```tsx
import RuleList from '@/components/categories/rules/RuleList';
import type { CategoryMatchType } from '@/types';
```

Add state next to the existing `active` state (near line 29):

```tsx
  const [ruleMatchType, setRuleMatchType] = useState<CategoryMatchType>('ALL');
```

In the `loadCategory` effect, next to `setActive(cat.is_active ?? true);` (line 48), add:

```tsx
          setRuleMatchType(cat.rule_match_type ?? 'ALL');
```

- [ ] **Step 2: Include `rule_match_type` in the edit-flow save**

In `handleSubmit`, inside the `if (editId) { ... }` branch, add `rule_match_type: ruleMatchType,` to the `updateCategory` call:

```tsx
        await updateCategory(editId, {
          name: name.trim(),
          slug: slugVal,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          sort_order: sortOrder,
          is_active: active,
          image_url: finalImageUrl,
          rule_match_type: ruleMatchType,
        });
```

- [ ] **Step 3: Render the Conditions panel in edit mode**

After the closing `</div>` of the main form card (the `<div className="bg-white border border-[#E8E0D5] p-8 shadow-xs">...</div>` wrapping the `<form>`, just before the final closing `</div>` of the component's root), add:

```tsx
      {editId && (
        <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs mt-6">
          <RuleList
            categoryId={editId}
            matchType={ruleMatchType}
            onMatchTypeChange={setRuleMatchType}
          />
        </div>
      )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`
Navigate to `/categories`, click **Edit** on an existing category, confirm a "Conditions" panel appears below the form with an "Add Condition" button and a "Re-evaluate All Products" link. Add a condition (e.g. Field=Work Type, Operator=Contains, Value=Zardozi), confirm it appears in the list. Confirm the panel does **not** appear on `/categories/add` (create mode, no `editId`).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/categories/add/page.tsx"
git commit -m "feat(category-rules): embed Conditions panel in category edit page"
```

---

