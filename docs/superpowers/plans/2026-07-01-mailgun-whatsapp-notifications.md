# Mailgun + WhatsApp Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transactional email notifications via Mailgun and WhatsApp deep-links for orders and enquiries, keeping all secrets server-side in Supabase edge functions.

**Architecture:** A shared Mailgun helper module (`_shared/mailgun.ts`) is imported by three edge functions: the existing `create-order` (extended for confirmation email), a new `order-status-notify` (called fire-and-forget from the admin service after DB update), and a new `enquiry-notify` (called from the storefront after enquiry insert). WhatsApp uses `wa.me` deep-links — one pre-filled link on the order detail page, and one embedded in the admin notification emails so the admin can click to WhatsApp the customer.

**Tech Stack:** Deno (Supabase edge functions), Mailgun REST API (fetch, no SDK), `@supabase/supabase-js@2` (jsr), React/Next.js for the admin UI change.

## Global Constraints

- Mailgun API key, domain, and admin email are Supabase function secrets — never in client-side code.
- All new edge functions must return JSON with CORS headers identical to `create-order`.
- `order-status-notify` must not block the admin status update — call fire-and-forget (`.catch(console.error)`, no `await`).
- `enquiry-notify` is auth'd with `x-storefront-secret` header (same pattern as the existing storefront secret); it is called from the **storefront** (MEI-35), not from the admin panel.
- `order-status-notify` is auth'd by verifying the caller's Supabase JWT — any authenticated admin user may trigger it.
- Emails that fail to send must never cause the primary operation (order creation, status update, enquiry insert) to fail. Wrap email sends in try/catch; log errors.
- Status notifications are only sent for statuses that matter to the customer: `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`. Skip `PENDING` (that's the internal default).
- `deno check` must pass on all modified/new edge function files before deployment.
- `npx tsc --noEmit` must pass on all modified Next.js/TypeScript files before committing.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/functions/_shared/mailgun.ts` | Create | `sendEmail()` — Mailgun REST API wrapper |
| `supabase/functions/_shared/email-templates.ts` | Create | HTML email templates for each notification type |
| `supabase/functions/create-order/index.ts` | Modify | Send confirmation email to customer + admin after successful `create_order_txn` |
| `supabase/functions/order-status-notify/index.ts` | Create | Verify JWT, fetch order+customer, send status update email to customer |
| `supabase/functions/enquiry-notify/index.ts` | Create | Verify storefront secret, fetch enquiry, send receipt to customer + notification to admin |
| `services/orders.ts` | Modify | Fire-and-forget call to `order-status-notify` after `updateOrderStatus` |
| `app/(app)/orders/[id]/page.tsx` | Modify | Add "Message on WhatsApp" button (mirrors the one already on the enquiry detail page) |

---

## Task 1: Shared Mailgun Helper + Email Templates

**Files:**
- Create: `supabase/functions/_shared/mailgun.ts`
- Create: `supabase/functions/_shared/email-templates.ts`

**Interfaces:**
- Produces: `sendEmail(opts: SendEmailOptions): Promise<void>` — throws on Mailgun error
- Produces: `orderConfirmationCustomer(opts)`, `orderStatusUpdateCustomer(opts)`, `newOrderAdminNotification(opts)`, `newEnquiryCustomerReceipt(opts)`, `newEnquiryAdminNotification(opts)` — each returns `string` (HTML)

- [ ] **Step 1: Create `supabase/functions/_shared/mailgun.ts`**

```typescript
// supabase/functions/_shared/mailgun.ts

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = Deno.env.get('MAILGUN_API_KEY');
  const domain = Deno.env.get('MAILGUN_DOMAIN');
  const from = Deno.env.get('MAILGUN_FROM') ?? `MEI Bridal Couture <noreply@${domain}>`;

  if (!apiKey || !domain) {
    throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set');
  }

  const form = new FormData();
  form.append('from', from);
  form.append('to', opts.to);
  form.append('subject', opts.subject);
  form.append('html', opts.html);

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailgun ${res.status}: ${body}`);
  }
}
```

- [ ] **Step 2: Create `supabase/functions/_shared/email-templates.ts`**

```typescript
// supabase/functions/_shared/email-templates.ts

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ee;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;max-width:560px;">
        <tr><td style="padding:32px 40px 16px;border-top:3px solid #c9a465;text-align:center;">
          <p style="font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a465;margin:0;">MEI Bridal Couture</p>
        </td></tr>
        <tr><td style="padding:8px 40px 40px;">${content}</td></tr>
        <tr><td style="padding:16px 40px;border-top:1px solid #f0ede8;text-align:center;">
          <p style="font-size:11px;color:#aaa;margin:0;">MEI Bridal Couture · Mumbai, India</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Customer: order confirmation ─────────────────────────────────────────────

export function orderConfirmationCustomer(opts: {
  customerName: string;
  orderNumber: string;
  itemSummary: Array<{ name: string; quantity: number }>;
  total: number;
}): string {
  const rows = opts.itemSummary
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-size:13px;color:#3d3d3d;">${i.name}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-size:13px;color:#3d3d3d;text-align:right;">×${i.quantity}</td></tr>`
    )
    .join('');

  return baseLayout(`
    <h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">Order Confirmed</h2>
    <p style="font-size:14px;color:#555;margin:0 0 8px;">Dear ${opts.customerName},</p>
    <p style="font-size:14px;color:#555;margin:0 0 24px;">
      Thank you for your order. We have received your payment and are preparing your ensemble with care.
    </p>
    <p style="font-size:13px;font-weight:600;color:#c9a465;letter-spacing:0.1em;margin:0 0 16px;text-transform:uppercase;">${opts.orderNumber}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><tbody>${rows}</tbody>
      <tfoot><tr>
        <td style="padding-top:12px;font-size:14px;font-weight:600;color:#c9a465;">Total</td>
        <td style="padding-top:12px;font-size:14px;font-weight:600;color:#c9a465;text-align:right;">₹${opts.total.toLocaleString('en-IN')}</td>
      </tr></tfoot>
    </table>
    <p style="font-size:13px;color:#888;margin:0;">We will keep you updated as your order progresses. For any queries, simply reply to this email.</p>
  `);
}

// ─── Customer: order status update ───────────────────────────────────────────

export function orderStatusUpdateCustomer(opts: {
  customerName: string;
  orderNumber: string;
  newStatus: string;
}): string {
  const messages: Record<string, string> = {
    CONFIRMED: 'Your order has been confirmed and is being prepared by our artisans.',
    PROCESSING: 'Our team is working on your ensemble.',
    SHIPPED: 'Your order is on its way to you.',
    DELIVERED: 'Your order has been delivered. We hope you love it.',
    CANCELLED: 'Your order has been cancelled. Please contact us if you have any questions.',
  };
  const message = messages[opts.newStatus] ?? `Your order status has been updated to ${opts.newStatus}.`;

  return baseLayout(`
    <h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">Order Update</h2>
    <p style="font-size:14px;color:#555;margin:0 0 8px;">Dear ${opts.customerName},</p>
    <p style="font-size:14px;color:#555;margin:0 0 16px;">${message}</p>
    <p style="font-size:13px;font-weight:600;color:#c9a465;letter-spacing:0.1em;margin:0;text-transform:uppercase;">${opts.orderNumber} · ${opts.newStatus}</p>
  `);
}

// ─── Admin: new order notification ───────────────────────────────────────────

export function newOrderAdminNotification(opts: {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  orderNumber: string;
  total: number;
  adminOrderUrl: string;
}): string {
  const phoneRow = opts.customerPhone
    ? `<tr><td style="padding:4px 0;color:#999;width:100px;">Phone</td><td style="padding:4px 0;">${opts.customerPhone}</td></tr>`
    : '';
  const waHref = opts.customerPhone
    ? `https://wa.me/${opts.customerPhone.replace(/[^\d]/g, '')}?text=Hello%20${encodeURIComponent(opts.customerName)}%2C%20regarding%20your%20order%20${encodeURIComponent(opts.orderNumber)}`
    : null;
  const waBtn = waHref
    ? `<a href="${waHref}" style="display:inline-block;background:#25D366;color:white;font-size:12px;font-weight:600;padding:8px 16px;text-decoration:none;margin-left:8px;">WhatsApp Customer</a>`
    : '';

  return baseLayout(`
    <h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">New Order Received</h2>
    <p style="font-size:13px;font-weight:600;color:#c9a465;letter-spacing:0.1em;margin:0 0 16px;text-transform:uppercase;">${opts.orderNumber}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#555;margin-bottom:24px;">
      <tr><td style="padding:4px 0;color:#999;width:100px;">Customer</td><td style="padding:4px 0;">${opts.customerName}</td></tr>
      <tr><td style="padding:4px 0;color:#999;">Email</td><td style="padding:4px 0;">${opts.customerEmail}</td></tr>
      ${phoneRow}
      <tr><td style="padding:4px 0;color:#999;">Total</td><td style="padding:4px 0;font-weight:600;color:#1a1a1a;">₹${opts.total.toLocaleString('en-IN')}</td></tr>
    </table>
    <a href="${opts.adminOrderUrl}" style="display:inline-block;background:#1a1a1a;color:white;font-size:12px;font-weight:600;letter-spacing:0.08em;padding:10px 20px;text-decoration:none;text-transform:uppercase;">View Order</a>${waBtn}
  `);
}

// ─── Customer: enquiry receipt ────────────────────────────────────────────────

export function newEnquiryCustomerReceipt(opts: {
  name: string;
  message: string;
}): string {
  return baseLayout(`
    <h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">We've received your enquiry</h2>
    <p style="font-size:14px;color:#555;margin:0 0 8px;">Dear ${opts.name},</p>
    <p style="font-size:14px;color:#555;margin:0 0 24px;">
      Thank you for reaching out to MEI Bridal Couture. Our team will review your enquiry and be in touch within 1–2 business days.
    </p>
    <div style="background:#faf8f5;border-left:3px solid #c9a465;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#555;margin:0;font-style:italic;">"${opts.message}"</p>
    </div>
    <p style="font-size:13px;color:#888;margin:0;">For urgent queries, please call or WhatsApp us directly.</p>
  `);
}

// ─── Admin: new enquiry notification ─────────────────────────────────────────

export function newEnquiryAdminNotification(opts: {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  occasion: string | null;
  budget: string | null;
  adminEnquiryUrl: string;
}): string {
  const phoneRow = opts.phone
    ? `<tr><td style="padding:4px 0;color:#999;width:100px;">Phone</td><td style="padding:4px 0;">${opts.phone}</td></tr>`
    : '';
  const occasionRow = opts.occasion
    ? `<tr><td style="padding:4px 0;color:#999;">Occasion</td><td style="padding:4px 0;">${opts.occasion}</td></tr>`
    : '';
  const budgetRow = opts.budget
    ? `<tr><td style="padding:4px 0;color:#999;">Budget</td><td style="padding:4px 0;">${opts.budget}</td></tr>`
    : '';
  const waHref = opts.phone
    ? `https://wa.me/${opts.phone.replace(/[^\d]/g, '')}?text=Hello%20${encodeURIComponent(opts.name)}%2C%20regarding%20your%20enquiry%20with%20MEI%20Bridal%20Couture`
    : null;
  const waBtn = waHref
    ? `<a href="${waHref}" style="display:inline-block;background:#25D366;color:white;font-size:12px;font-weight:600;padding:8px 16px;text-decoration:none;margin-left:8px;">WhatsApp Customer</a>`
    : '';

  return baseLayout(`
    <h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">New Enquiry</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#555;margin-bottom:16px;">
      <tr><td style="padding:4px 0;color:#999;width:100px;">Name</td><td style="padding:4px 0;">${opts.name}</td></tr>
      <tr><td style="padding:4px 0;color:#999;">Email</td><td style="padding:4px 0;">${opts.email}</td></tr>
      ${phoneRow}${occasionRow}${budgetRow}
    </table>
    <div style="background:#faf8f5;border-left:3px solid #c9a465;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#555;margin:0;">${opts.message}</p>
    </div>
    <a href="${opts.adminEnquiryUrl}" style="display:inline-block;background:#1a1a1a;color:white;font-size:12px;font-weight:600;letter-spacing:0.08em;padding:10px 20px;text-decoration:none;text-transform:uppercase;">View Enquiry</a>${waBtn}
  `);
}
```

- [ ] **Step 3: Type-check both shared files**

```bash
deno check supabase/functions/_shared/mailgun.ts
deno check supabase/functions/_shared/email-templates.ts
```

Expected: no errors on either file.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/mailgun.ts supabase/functions/_shared/email-templates.ts
git commit -m "feat(notifications): add Mailgun helper and email templates"
```

---

## Task 2: Extend `create-order` with Confirmation Emails

**Files:**
- Modify: `supabase/functions/create-order/index.ts`

**Interfaces:**
- Consumes: `sendEmail` from `../_shared/mailgun.ts`
- Consumes: `orderConfirmationCustomer`, `newOrderAdminNotification` from `../_shared/email-templates.ts`
- Produces: same HTTP interface — email send failures are logged but do not change the 200 response

- [ ] **Step 1: Add the email-send block to `create-order/index.ts`**

After the line `log('order created', ...)` (currently line 191) and before the final `return jsonResponse(...)`, insert a `sendNotifications` helper and call it. The full replacement for the success section (from line 190 to the final return):

```typescript
    log('order created', {
      order_id: String(data.order_id),
      already_exists: String(data.already_exists),
    });

    // Send notifications fire-and-forget — email failure must never break order creation
    if (!data.already_exists) {
      const adminEmail = Deno.env.get('ADMIN_EMAIL');
      const adminUrl = Deno.env.get('ADMIN_URL') ?? '';
      const itemSummary = body.items.map((i) => ({ name: i.name, quantity: i.quantity }));

      const customerEmailPromise = sendEmail({
        to: body.customer.email,
        subject: `Order confirmed — ${data.order_number}`,
        html: orderConfirmationCustomer({
          customerName: body.customer.name,
          orderNumber: data.order_number,
          itemSummary,
          total: Number(data.total),
        }),
      }).catch((err) => log('customer confirmation email failed', { error: String(err) }));

      const adminEmailPromise = adminEmail
        ? sendEmail({
            to: adminEmail,
            subject: `New order ${data.order_number} from ${body.customer.name}`,
            html: newOrderAdminNotification({
              customerName: body.customer.name,
              customerEmail: body.customer.email,
              customerPhone: body.customer.phone ?? null,
              orderNumber: data.order_number,
              total: Number(data.total),
              adminOrderUrl: `${adminUrl}/orders/${data.order_id}`,
            }),
          }).catch((err) => log('admin order notification failed', { error: String(err) }))
        : Promise.resolve();

      await Promise.allSettled([customerEmailPromise, adminEmailPromise]);
    }

    return jsonResponse(
      {
        success: true,
        order_id: data.order_id,
        order_number: data.order_number,
        total: data.total,
      },
      200,
      { 'x-request-id': requestId }
    );
```

- [ ] **Step 2: Add imports at the top of `create-order/index.ts`**

After `import { createClient } from 'jsr:@supabase/supabase-js@2';`, add:

```typescript
import { sendEmail } from '../_shared/mailgun.ts';
import { orderConfirmationCustomer, newOrderAdminNotification } from '../_shared/email-templates.ts';
```

- [ ] **Step 3: Type-check the modified function**

```bash
deno check supabase/functions/create-order/index.ts
```

Expected: no errors.

- [ ] **Step 4: Test locally in bypass mode (no email expected)**

```bash
# Start Supabase local stack if not running
supabase start

# Call create-order with bypass mode — email env vars are absent so sendEmail will throw,
# but the catch swallows it and returns 200 regardless.
curl -X POST http://127.0.0.1:54321/functions/v1/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"name": "Test", "email": "test@example.com", "phone": "9999999999", "city": "Mumbai"},
    "items": [{"product_id": "00000000-0000-0000-0000-000000000000", "name": "Test Piece", "quantity": 1}],
    "shipping_address": {},
    "payment": {"provider": "razorpay", "payment_id": "bypass_test", "order_id": "", "signature": ""}
  }'
```

Expected: `{"success":true,"order_id":"BYPASS-...","order_number":"BYPASS-...","total":1}` (bypass returns early before email code runs, so no error).

- [ ] **Step 5: Set Supabase secrets for production**

Document the required secrets. Run these against the linked Supabase project:

```bash
supabase secrets set MAILGUN_API_KEY=<your-mailgun-private-api-key>
supabase secrets set MAILGUN_DOMAIN=<your-mailgun-domain>
supabase secrets set MAILGUN_FROM="MEI Bridal Couture <noreply@<your-mailgun-domain>>"
supabase secrets set ADMIN_EMAIL=<studio-email-for-notifications>
supabase secrets set ADMIN_URL=https://<your-admin-domain>
```

- [ ] **Step 6: Deploy and smoke-test against production**

```bash
supabase functions deploy create-order
```

Place a test order through the storefront and verify:
1. Supabase function logs show `customer confirmation email failed` is absent (or present with a meaningful Mailgun error if domain is not verified yet).
2. Mailgun dashboard shows a queued/delivered message to the test customer email.
3. Admin receives notification email.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/create-order/index.ts
git commit -m "feat(notifications): send order confirmation email on create-order"
```

---

## Task 3: `order-status-notify` Edge Function + Admin Service Wire-up

**Files:**
- Create: `supabase/functions/order-status-notify/index.ts`
- Modify: `services/orders.ts`

**Interfaces:**
- Consumes: `sendEmail` from `../_shared/mailgun.ts`
- Consumes: `orderStatusUpdateCustomer` from `../_shared/email-templates.ts`
- Endpoint: `POST /functions/v1/order-status-notify`
  - Request body: `{ order_id: string; new_status: string }`
  - Auth: `Authorization: Bearer <supabase-user-jwt>` (passed automatically by `supabase.functions.invoke`)
  - Response 200: `{ success: true }`
  - Response 400: `{ success: false, error: "INVALID_PAYLOAD" | "SKIP_STATUS" }`
  - Response 401: `{ success: false, error: "UNAUTHORIZED" }`
  - Response 404: `{ success: false, error: "ORDER_NOT_FOUND" }`
- Consumed by: `services/orders.ts:updateOrderStatus` — fire-and-forget

- [ ] **Step 1: Create `supabase/functions/order-status-notify/index.ts`**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailgun.ts';
import { orderStatusUpdateCustomer } from '../_shared/email-templates.ts';

// Statuses that trigger a customer email. PENDING is the internal default and needs no email.
const NOTIFY_STATUSES = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  // Verify caller is an authenticated Supabase user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'UNAUTHORIZED' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify JWT by creating a user-scoped client and calling getUser
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ success: false, error: 'UNAUTHORIZED' }, 401);

  const body = await req.json().catch(() => null);
  if (!body?.order_id || !body?.new_status) {
    return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);
  }

  if (!NOTIFY_STATUSES.has(body.new_status)) {
    return json({ success: false, error: 'SKIP_STATUS' }, 400);
  }

  // Fetch order with customer using service role (bypasses RLS)
  const db = createClient(supabaseUrl, serviceKey);
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('order_number, customers(name, email)')
    .eq('id', body.order_id)
    .is('deleted_at', null)
    .single();

  if (orderError || !order) return json({ success: false, error: 'ORDER_NOT_FOUND' }, 404);

  const customer = order.customers as { name: string; email: string | null } | null;
  if (!customer?.email) return json({ success: true, skipped: 'no_customer_email' });

  try {
    await sendEmail({
      to: customer.email,
      subject: `Update on your order ${order.order_number}`,
      html: orderStatusUpdateCustomer({
        customerName: customer.name,
        orderNumber: order.order_number,
        newStatus: body.new_status,
      }),
    });
  } catch (err) {
    console.error('order-status-notify email failed:', err);
  }

  return json({ success: true });
});
```

- [ ] **Step 2: Type-check the new function**

```bash
deno check supabase/functions/order-status-notify/index.ts
```

Expected: no errors.

- [ ] **Step 3: Modify `services/orders.ts` to fire-and-forget `order-status-notify`**

In `updateOrderStatus`, after `return data as Order`, add the fire-and-forget call. The full updated function (replace lines 46-66):

```typescript
export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = createClient()
  const response = await supabase
    .from('orders')
    .update({ status } as never)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  const { data, error } = response as { data: Order | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'order',
    resourceId: id,
    newData: { status },
  })

  // Fire-and-forget: notify customer of status change
  // SKIP_STATUS (PENDING) returns 400 — that's fine, the catch swallows it
  supabase.functions
    .invoke('order-status-notify', { body: { order_id: id, new_status: status } })
    .catch((err) => console.error('order-status-notify invoke failed:', err))

  return data as Order
}
```

- [ ] **Step 4: Type-check the modified service**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Deploy and manual test**

```bash
supabase functions deploy order-status-notify
```

Open the admin panel, open an existing order, change its status. Verify:
1. Status updates instantly in the UI (no delay — fire-and-forget).
2. In Supabase function logs (`supabase functions log order-status-notify`), a successful invocation appears.
3. The customer email address receives the status update email.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/order-status-notify/index.ts services/orders.ts
git commit -m "feat(notifications): add order-status-notify edge function and wire to admin service"
```

---

## Task 4: `enquiry-notify` Edge Function

**Files:**
- Create: `supabase/functions/enquiry-notify/index.ts`

**Interfaces:**
- Consumes: `sendEmail` from `../_shared/mailgun.ts`
- Consumes: `newEnquiryCustomerReceipt`, `newEnquiryAdminNotification` from `../_shared/email-templates.ts`
- Endpoint: `POST /functions/v1/enquiry-notify`
  - Request body: `{ enquiry_id: string }`
  - Auth: `x-storefront-secret: <STOREFRONT_API_SECRET>` header
  - Response 200: `{ success: true }`
  - Response 401: `{ success: false, error: "UNAUTHORIZED" }`
  - Response 400: `{ success: false, error: "INVALID_PAYLOAD" }`
  - Response 404: `{ success: false, error: "ENQUIRY_NOT_FOUND" }`
- Called by: MEI storefront (MEI-35) after inserting an enquiry

**Note:** This function is deployed here but wired up in MEI-35. The storefront calls it with `STOREFRONT_API_SECRET` (already a secret in the Supabase project from the payment webhook).

- [ ] **Step 1: Create `supabase/functions/enquiry-notify/index.ts`**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailgun.ts';
import { newEnquiryCustomerReceipt, newEnquiryAdminNotification } from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-storefront-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  // Verify storefront secret
  const storefrontSecret = Deno.env.get('STOREFRONT_API_SECRET');
  const callerSecret = req.headers.get('x-storefront-secret');
  if (!storefrontSecret || callerSecret !== storefrontSecret) {
    return json({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body?.enquiry_id) return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: enquiry, error } = await db
    .from('enquiries')
    .select('name, email, phone, message, occasion, budget')
    .eq('id', body.enquiry_id)
    .single();

  if (error || !enquiry) return json({ success: false, error: 'ENQUIRY_NOT_FOUND' }, 404);

  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const adminUrl = Deno.env.get('ADMIN_URL') ?? '';

  const customerPromise = sendEmail({
    to: enquiry.email,
    subject: 'We've received your enquiry — MEI Bridal Couture',
    html: newEnquiryCustomerReceipt({
      name: enquiry.name,
      message: enquiry.message,
    }),
  }).catch((err) => console.error('enquiry customer receipt failed:', err));

  const adminPromise = adminEmail
    ? sendEmail({
        to: adminEmail,
        subject: `New enquiry from ${enquiry.name}`,
        html: newEnquiryAdminNotification({
          name: enquiry.name,
          email: enquiry.email,
          phone: enquiry.phone ?? null,
          message: enquiry.message,
          occasion: enquiry.occasion ?? null,
          budget: enquiry.budget ?? null,
          adminEnquiryUrl: `${adminUrl}/enquiries/${body.enquiry_id}`,
        }),
      }).catch((err) => console.error('enquiry admin notification failed:', err))
    : Promise.resolve();

  await Promise.allSettled([customerPromise, adminPromise]);

  return json({ success: true });
});
```

- [ ] **Step 2: Type-check the new function**

```bash
deno check supabase/functions/enquiry-notify/index.ts
```

Expected: no errors.

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy enquiry-notify
```

- [ ] **Step 4: Smoke-test with curl**

```bash
# Insert a test enquiry directly in Supabase dashboard and note its UUID, e.g.:
ENQUIRY_ID="<uuid-from-db>"
STOREFRONT_SECRET="$(supabase secrets list | grep STOREFRONT_API_SECRET | awk '{print $2}')"

# Alternatively, retrieve the secret from the Supabase dashboard under Project Settings > Edge Functions > Secrets

curl -X POST https://<project-ref>.supabase.co/functions/v1/enquiry-notify \
  -H "Content-Type: application/json" \
  -H "x-storefront-secret: $STOREFRONT_SECRET" \
  -d '{"enquiry_id": "'$ENQUIRY_ID'"}'
```

Expected response: `{"success":true}`. Check Mailgun dashboard for two sent emails (customer receipt + admin notification).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/enquiry-notify/index.ts
git commit -m "feat(notifications): add enquiry-notify edge function for customer receipt and admin notification"
```

---

## Task 5: WhatsApp Button on Order Detail Page

**Files:**
- Modify: `app/(app)/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `order.customers.phone` (already fetched by `useOrder` hook via `getOrderById`)
- Produces: A "Message on WhatsApp" anchor button, styled identically to the one on the enquiry detail page (`app/(app)/enquiries/[id]/page.tsx` line 212–222)

- [ ] **Step 1: Add WhatsApp button to the status block in `app/(app)/orders/[id]/page.tsx`**

Locate the status block (line 162 — the `<div className="flex flex-col items-end ...">` containing the `<select>`). Replace the entire `<div className="flex flex-col items-end w-full sm:w-auto">` block with the version below, which adds the WhatsApp anchor beneath the status dot indicator:

```tsx
        <div className="flex flex-col items-end w-full sm:w-auto gap-3">
          <div className="relative">
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              disabled={updateStatusMutation.isPending}
              className="border border-[#E8E0D5] bg-white pl-4 pr-10 py-2.5 text-[12px] font-medium text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] cursor-pointer appearance-none font-sans min-w-[140px] uppercase tracking-wider rounded-none"
            >
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <div className="absolute right-3.5 top-3.5 pointer-events-none text-zinc-400 text-[8px] font-sans">
              {updateStatusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin text-zinc-400" /> : '▼'}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(order.status)}`} />
            <span>{order.status}</span>
          </div>

          {order.customers?.phone && (
            <a
              href={`https://wa.me/${order.customers.phone.replace(/[^\d]/g, '')}?text=Hello%20${encodeURIComponent(order.customers.name ?? '')}%2C%20regarding%20your%20order%20${encodeURIComponent(order.order_number)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-[12px] font-bold px-4 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer select-none font-sans rounded-none"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585-1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754 9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z" />
              </svg>
              Message on WhatsApp
            </a>
          )}
        </div>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/orders/<any-order-id>`. Confirm:
1. WhatsApp button appears below the status dot for orders that have a customer phone number.
2. Button is absent for orders where `order.customers.phone` is null.
3. Clicking the button opens WhatsApp (or `wa.me` in browser) with the pre-filled message.
4. Status dropdown still works and updates the order.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/orders/[id]/page.tsx"
git commit -m "feat(notifications): add WhatsApp deep-link button to order detail page"
```

---

## Secrets Reference

All of the following must be set as Supabase edge function secrets:

| Secret | Example value | Used by |
|---|---|---|
| `MAILGUN_API_KEY` | `key-xxxxxxxxxxxxxxxxxxxx` | `create-order`, `order-status-notify`, `enquiry-notify` |
| `MAILGUN_DOMAIN` | `mg.meibridalcouture.com` | same |
| `MAILGUN_FROM` | `MEI Bridal Couture <noreply@mg.meibridalcouture.com>` | same |
| `ADMIN_EMAIL` | `studio@meibridalcouture.com` | `create-order`, `enquiry-notify` |
| `ADMIN_URL` | `https://admin.meibridalcouture.com` | `create-order`, `order-status-notify`, `enquiry-notify` |
| `STOREFRONT_API_SECRET` | (already set) | `enquiry-notify` |
| `SUPABASE_ANON_KEY` | (already set by Supabase) | `order-status-notify` |

Set via: `supabase secrets set KEY=value`

---

## Self-Review

**Spec coverage:**
- ✅ Order confirmation email to customer + admin on order creation — Task 2 (extends `create-order`)
- ✅ Order status-update emails when admin changes status — Task 3 (`order-status-notify` + service wire-up)
- ✅ Enquiry receipt email to customer + notification to admin on new enquiry — Task 4 (`enquiry-notify`)
- ✅ WhatsApp notification path for enquiries — already present on enquiry detail page; Task 4 embeds wa.me link in admin email
- ✅ WhatsApp notification path for orders — Task 5 (adds button to order detail page; Task 2 embeds wa.me link in admin email)
- ✅ Logic server-side in Supabase edge functions — Tasks 2, 3, 4
- ✅ Mailgun API key via Supabase function secrets — Secrets Reference section
- ✅ Email failures never break primary operations — all sends wrapped in `try/catch` or `.catch()`

**Placeholder scan:** None found.

**Type consistency:**
- `sendEmail(opts: SendEmailOptions)` — used identically in Tasks 2, 3, 4
- `orderConfirmationCustomer`, `orderStatusUpdateCustomer`, `newOrderAdminNotification`, `newEnquiryCustomerReceipt`, `newEnquiryAdminNotification` — all defined in Task 1 and imported with the same names in Tasks 2, 3, 4
- `order.customers` in Task 5 references the `OrderDetail.customers: Customer | null` type from `types/index.ts:22` — `Customer` has `phone: string | null` from `customers` table

**Dependency order:** Tasks 1 → 2 → 3 → 4 → 5. Task 1 must ship before any other task. Tasks 3, 4, 5 are independent of each other after Task 1 is done.
