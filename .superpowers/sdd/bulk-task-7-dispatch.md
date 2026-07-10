# Task 7 Dispatcher (Ready after Task 6 approved)

## Task: Full verification pass

Brief: `.superpowers/sdd/bulk-task-7-brief.md`
Report: `.superpowers/sdd/bulk-task-7-report.md`

This is verification-only — no code changes. Confirm all integration works and no regressions exist.

## Steps:

1. Run full test suite:
   ```bash
   npx vitest run
   ```
   Expected: all tests pass, no new failures

2. Type-check:
   ```bash
   npx tsc --noEmit
   ```
   Expected: zero errors

3. Lint:
   ```bash
   npm run lint
   ```
   Expected: zero errors

4. Production build:
   ```bash
   npm run build
   ```
   Expected: succeeds

5. If any fixes needed:
   ```bash
   git add -A
   git commit -m "Fix verification findings for bulk import batch insert (MEI-43)"
   ```

## Report format:

```
Status: DONE
Test results: [pass/fail summary with counts]
Type check: PASS | FAIL
Lint: PASS | FAIL
Build: PASS | FAIL
Fixes needed: [none | describe]
```

No new code to write — just verification that everything integrates correctly.
