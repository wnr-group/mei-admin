# Task 6: Wire sync into product create/update — Report

## Overview
Successfully implemented the integration of `syncProductCategoryAssignments` into the `createProduct` and `updateProduct` functions, following TDD approach.

## Implementation Summary

### Changes Made
1. **`services/products.ts`**
   - Added import: `import { syncProductCategoryAssignments } from '@/services/product-categories'`
   - Added `syncCategoriesOrLog` helper function that wraps the sync call with error handling (logs failures, never blocks product save)
   - Wired sync call in no-slug branch of `createProduct` (after audit log)
   - Wired sync call in slug-disambiguation loop of `createProduct` (after audit log)
   - Wired sync call in `updateProduct` (after audit log)

2. **`__tests__/services/products.test.ts`**
   - Added mock for `syncProductCategoryAssignments` at top of file
   - Added test: `createProduct: syncs product-category assignments after a successful create`
   - Added test: `updateProduct: syncs product-category assignments after a successful update`

## Test Evidence

### Initial State (Before Implementation)
```
Test Files: 1 failed (1)
Tests: 2 failed | 27 passed (29)

FAIL: createProduct > syncs product-category assignments after a successful create
AssertionError: expected "vi.fn()" to be called with arguments
Number of calls: 0

FAIL: updateProduct > syncs product-category assignments after a successful update
AssertionError: expected "vi.fn()" to be called with arguments
Number of calls: 0
```

Status: ✅ Confirmed both new tests FAILED with 0 calls to mockSyncProductCategoryAssignments
Status: ✅ Confirmed all 27 pre-existing tests still PASSED

### Final State (After Implementation)
```
Test Files: 1 passed (1)
Tests: 29 passed (29)
```

Status: ✅ All 29 tests PASS
Status: ✅ The 2 new tests now PASS (sync function called with correct product)
Status: ✅ All 27 pre-existing tests still PASS, including slug-disambiguation tests with `expect(mockFrom).toHaveBeenCalledTimes(...)` assertions

## Key Validations

1. ✅ Sync call wrapping in `syncCategoriesOrLog` prevents any sync error from blocking product save
2. ✅ Sync is called in both branches of `createProduct` (no-slug and slug-disambiguation loop)
3. ✅ Sync is called in `updateProduct` after successful save
4. ✅ All previous call-count assertions still pass (mockFrom call counts unaffected)
5. ✅ Mock framework properly isolates the sync from the main Supabase mock chain

## Commit
```
f65c3ef feat(category-rules): sync category assignments on every product save
```

## Test Runner Output
Duration: 1.50s
Passed: 29/29 tests
Status: ALL PASS
