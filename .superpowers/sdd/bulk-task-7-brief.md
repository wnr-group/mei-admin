# Task 7 Brief: Full verification pass

## Overview

Run the complete project test suite, type-check, lint, and production build to verify all changes integrate cleanly and no regressions exist. This is a verification-only task with no code changes.

## Exact Requirements (from Plan Section: Task 7)

### Step 1: Run full test suite

```bash
npx vitest run
```

**Expected:** All tests pass, including:
- Every new test added in Tasks 1–4 (slug, product-code, retry, import-errors, bulkImportProducts)
- All pre-existing tests (lib/csv-import/*.test.ts, __tests__/services/*.test.ts)
- No test regressions

### Step 2: Type-check

```bash
npx tsc --noEmit
```

**Expected:** Zero errors

### Step 3: Lint

```bash
npm run lint
```

**Expected:** Zero errors

### Step 4: Production build

```bash
npm run build
```

**Expected:** Build succeeds; `/products/import` still appears in route table

### Step 5: Final commit (if needed)

If any of the above steps required fixes, create a commit:
```bash
git add -A
git commit -m "Fix verification findings for bulk import batch insert (MEI-43)"
```

If no fixes were needed, no commit is necessary — this task is complete once all four verification steps pass.

## Acceptance criteria:
- ✅ Full test suite passes (no new failures, no regressions)
- ✅ TypeScript strict mode clean
- ✅ ESLint clean
- ✅ Production build succeeds
- ✅ No extra verification commits (or one fix commit if needed)

## Report File
Report to: `.superpowers/sdd/bulk-task-7-report.md`

Format:
- Status: DONE | NEEDS_CONTEXT | BLOCKED
- Test results: counts and pass/fail
- Type check result: pass/fail
- Lint result: pass/fail
- Build result: pass/fail
- Any issues found and resolved
