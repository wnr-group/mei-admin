# Task 8 Brief — Regression Testing (Phase 8)

**Plan:** docs/superpowers/plans/2026-07-02-email-notification-stabilization.md § Task 8

**Scope:** Verify that email notification changes (Tasks 1–7) do not affect any other features.

**Files modified in this plan:**
- `supabase/functions/_shared/log.ts` (new)
- `supabase/functions/_shared/log.test.ts` (new)
- `supabase/functions/notification-worker/index.ts` (modified)
- `supabase/functions/create-order/index.ts` (modified)

**Files NOT modified (safe to assume unaffected):**
- All checkout/payment logic
- All inventory management
- All admin UI
- All storefront UI
- All enquiry flow
- All order details/status
- All cart/search

**Changes to modified files are additive (logging only):**
- No logic changes to order creation, payment, queuing, or retry
- No schema changes
- No API contract changes
- No new dependencies

---

## Regression Test Checklist

### 1. Checkout + Payment + Order Creation + Inventory

**Test:** Place one real (or bypass-mode) order end-to-end.

**Verify:**
- [ ] Razorpay signature verification still works (create-order L119 unchanged)
- [ ] `create_order_txn` RPC returns an order (core logic unchanged)
- [ ] Inventory decremented correctly (queue enqueue is fire-and-forget)
- [ ] Order response shape unchanged: `{ success, order_id, order_number, total }`
- [ ] Email failure (even if Mailgun down) does NOT change order response

**Command:** Place a test order via storefront checkout or use bypass mode.

**Expected:** Order succeeds, inventory updates, response is `success: true`.

---

### 2. Admin Dashboard + Order Details + Status Change

**Test:** Open admin → dashboard, open an order, change status.

**Verify:**
- [ ] Dashboard loads (stats render)
- [ ] Order list loads
- [ ] Order details render completely
- [ ] Status dropdown works
- [ ] Status change updates instantly (fire-and-forget notify, no delay)
- [ ] `wa.me` WhatsApp button on order detail is unchanged (still present if phone exists)

**Command:** 
```bash
npm run dev
# Navigate to http://localhost:3000/orders
# Open any order
# Change status
```

**Expected:** All UI interactions smooth, no new errors in console.

---

### 3. Enquiry Flow

**Test:** Submit a storefront enquiry (unchanged path).

**Verify:**
- [ ] Enquiry form submits
- [ ] Enquiry created in DB
- [ ] No errors in logs
- [ ] Enquiry detail page loads
- [ ] `wa.me` WhatsApp button on enquiry detail is unchanged

**Command:** Via storefront at `../mei`, submit an enquiry.

**Expected:** Enquiry created, no breakage.

---

### 4. Cart + Search + Customer Flow

**Test:** Exercise storefront core features.

**Verify:**
- [ ] Add to cart → cart updates
- [ ] Search products → results load
- [ ] Browse categories → products load
- [ ] Customer profile (if logged in) → loads

**Command:** Via storefront at `../mei`.

**Expected:** All features work, no new errors.

---

### 5. Build + Type-Check Gate

**Test:** Verify TypeScript and build still pass.

**Verify:**
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] `npm run build` succeeds (production build)

**Command:**
```bash
npx tsc --noEmit
npm run build
```

**Expected:** Both succeed with no errors.

---

## Report Template

Create `.superpowers/sdd/task-8-report.md`:

```markdown
# Task 8 Report — Regression Testing

## 1. Checkout + Payment + Order Creation + Inventory

**Order tested:**
- Order ID: [from order response]
- Status: success=true [yes/no]
- Inventory decremented: [yes/no]
- Response shape correct: [yes/no]

**Result:** [PASS/FAIL]

---

## 2. Admin Dashboard + Order Details + Status Change

**Dashboard loads:** [yes/no]
**Order list loads:** [yes/no]
**Order detail renders:** [yes/no]
**Status change instant (no delay):** [yes/no]
**WhatsApp button present (if phone exists):** [yes/no]
**Console errors:** [none / list if any]

**Result:** [PASS/FAIL]

---

## 3. Enquiry Flow

**Enquiry submitted:** [yes/no]
**Enquiry created in DB:** [yes/no]
**Enquiry detail loads:** [yes/no]
**WhatsApp button present (if phone exists):** [yes/no]

**Result:** [PASS/FAIL]

---

## 4. Cart + Search + Customer Flow

**Add to cart:** [works/broken]
**Search:** [works/broken]
**Browse categories:** [works/broken]
**Customer profile:** [works/broken / not applicable]

**Result:** [PASS/FAIL]

---

## 5. Build + Type-Check Gate

**`npx tsc --noEmit` result:** [PASS/FAIL] [output: none or errors]
**`npm run build` result:** [PASS/FAIL] [output: success or errors]

---

## Summary

All regression tests: [PASS/FAIL]

If any FAIL, describe the issue and whether it's related to notification changes or pre-existing.
```

---

## Report File

`.superpowers/sdd/task-8-report.md`

## Commit Pattern

```bash
test(notifications): Task 8 complete — regression testing verified (all unaffected features PASS)
```

## Status Report

Reply with:
- **DONE:** [all regression tests PASS]
- **BLOCKED:** [regression test failed — which one]
- **DONE_WITH_CONCERNS:** [all tests PASS but observations]
