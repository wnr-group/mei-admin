# Task 5 Report: Product-category sync service

## Status: DONE

## Failing-test evidence (Step 2)

```
FAIL  __tests__/services/product-categories.test.ts
Error: Failed to resolve import "@/services/product-categories"
  Tests  no tests (0 tests)
```

Expected failure — module did not exist yet.

## Passing-test output (Step 4)

```
 RUN  v4.1.8 C:/Users/Eshwar/WNR/mei-admin

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  16:39:09
   Duration  2.52s
```

All 11 tests pass on first implementation attempt.

## Commit

`d5ba754` — feat(category-rules): add product-category sync and re-evaluate-all service

## Constraints verified

1. `syncRuleCategoryAssignments` — only touches `source='rule'` rows. The dedicated test asserts exactly 3 DB calls (categories, product_categories rule-read, product_categories insert) — no manual-row calls.
2. `syncManualCategoryAssignment` — only passes `'manual'` to `reconcileSource`, never called by `reevaluateAllProducts`.
3. `reevaluateAllProducts` calls `syncRuleCategoryAssignments` directly — the "3 calls total" test would grow to 4 if the manual sync snuck in. Passes at 3.
4. Zero-rule categories filtered by `(c.category_rules ?? []).length > 0` in `getCategoriesWithRules`. Test confirms no inserts for `cat-empty`.
5. Unique violation `'23505'` is swallowed in the insert branch.

## Edge cases noted

- A product whose `category_id` matches a rule category simultaneously holds two distinct rows (`source='rule'` + `source='manual'`), valid under the 3-column unique constraint `(product_id, category_id, source)`. Test 7 covers this.
- `reconcileSource` with empty desired list and empty existing list makes exactly 1 DB call (the read) — no spurious insert or delete calls.
