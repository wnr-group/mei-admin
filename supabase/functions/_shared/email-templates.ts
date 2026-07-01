// supabase/functions/_shared/email-templates.ts

import type { NotificationType } from './notification-types.ts';

// ── Layout shell ──────────────────────────────────────────────────────────────

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MEI Bridal Couture</title>
</head>
<body style="margin:0;padding:0;background:#f5f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#f5f2ee;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
        style="background:#ffffff;max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="padding:32px 40px 16px;border-top:3px solid #c9a465;text-align:center;">
          <p style="font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;
            text-transform:uppercase;color:#c9a465;margin:0;">
            MEI Bridal Couture
          </p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:8px 40px 40px;">${content}</td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 40px;border-top:1px solid #f0ede8;text-align:center;">
          <p style="font-size:11px;color:#aaa;margin:0;">
            MEI Bridal Couture &middot; Mumbai, India
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function h2(text: string) {
  return `<h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;
    color:#1a1a1a;margin:0 0 16px 0;">${text}</h2>`;
}

function para(text: string) {
  return `<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px 0;">${text}</p>`;
}

function label(text: string) {
  return `<p style="font-size:13px;font-weight:600;color:#c9a465;letter-spacing:0.1em;
    text-transform:uppercase;margin:0 0 16px 0;">${text}</p>`;
}

function ctaButton(text: string, href: string, bg = '#1a1a1a') {
  return `<a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;
    font-size:12px;font-weight:600;letter-spacing:0.08em;padding:10px 20px;
    text-decoration:none;text-transform:uppercase;">${text}</a>`;
}

function waButton(phone: string, name: string, contextText: string) {
  const href = `https://wa.me/${phone.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(contextText)}`;
  return `<a href="${href}" style="display:inline-block;background:#25D366;color:#ffffff;
    font-size:12px;font-weight:600;padding:10px 16px;text-decoration:none;margin-left:8px;">
    <svg style="width:14px;height:14px;vertical-align:middle;fill:currentColor;margin-right:6px;"
      viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348
        5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28
        3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0
        24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585
        -1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754
        9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z"/>
    </svg>WhatsApp</a>`;
}

function metaTable(rows: Array<[string, string | null | undefined]>): string {
  const cells = rows
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:4px 0;width:110px;font-size:13px;color:#999;">${k}</td>
          <td style="padding:4px 0;font-size:13px;color:#555;">${v}</td>
        </tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${cells}</table>`;
}

// ── Template: ORDER_CONFIRMATION_CUSTOMER ────────────────────────────────────

export interface OrderConfirmationCustomerPayload {
  customerName: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number }>;
  total: number;
}

export function orderConfirmationCustomer(p: OrderConfirmationCustomerPayload): string {
  const rows = p.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-size:13px;color:#3d3d3d;">${i.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-size:13px;color:#3d3d3d;
            text-align:right;">&times;${i.quantity}</td>
        </tr>`
    )
    .join('');

  return base(`
    ${h2('Order Confirmed')}
    ${para(`Dear ${p.customerName},`)}
    ${para('Thank you for your order. We have received your payment and are preparing your ensemble with care.')}
    ${label(p.orderNumber)}
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td style="padding-top:12px;font-size:14px;font-weight:600;color:#c9a465;">Total</td>
          <td style="padding-top:12px;font-size:14px;font-weight:600;color:#c9a465;text-align:right;">
            &#8377;${p.total.toLocaleString('en-IN')}
          </td>
        </tr>
      </tfoot>
    </table>
    ${para('<span style="font-size:13px;color:#888;">We will keep you updated as your order progresses. For any queries, simply reply to this email.</span>')}
  `);
}

// ── Template: ORDER_CONFIRMATION_ADMIN ───────────────────────────────────────

export interface OrderConfirmationAdminPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  orderNumber: string;
  total: number;
  adminOrderUrl: string;
}

export function orderConfirmationAdmin(p: OrderConfirmationAdminPayload): string {
  const buttons = ctaButton('View Order', p.adminOrderUrl) +
    (p.customerPhone
      ? waButton(p.customerPhone, p.customerName, `Hello ${p.customerName}, regarding your order ${p.orderNumber}`)
      : '');

  return base(`
    ${h2('New Order Received')}
    ${label(p.orderNumber)}
    ${metaTable([
      ['Customer', p.customerName],
      ['Email', p.customerEmail],
      ['Phone', p.customerPhone],
      ['Total', `&#8377;${p.total.toLocaleString('en-IN')}`],
    ])}
    ${buttons}
  `);
}

// ── Template: ORDER_STATUS_UPDATE_CUSTOMER ───────────────────────────────────

export interface OrderStatusUpdateCustomerPayload {
  customerName: string;
  orderNumber: string;
  newStatus: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  CONFIRMED:  'Your order has been confirmed and is being prepared by our artisans.',
  PROCESSING: 'Our team is actively working on your ensemble.',
  SHIPPED:    'Your order is on its way to you.',
  DELIVERED:  'Your order has been delivered. We hope you love it.',
  CANCELLED:  'Your order has been cancelled. Please contact us if you have any questions.',
};

export function orderStatusUpdateCustomer(p: OrderStatusUpdateCustomerPayload): string {
  const message = STATUS_MESSAGES[p.newStatus] ??
    `Your order status has been updated to ${p.newStatus}.`;

  return base(`
    ${h2('Order Update')}
    ${para(`Dear ${p.customerName},`)}
    ${para(message)}
    ${label(`${p.orderNumber} &middot; ${p.newStatus}`)}
  `);
}

// ── Template: ENQUIRY_RECEIPT_CUSTOMER ───────────────────────────────────────

export interface EnquiryReceiptCustomerPayload {
  name: string;
  message: string;
}

export function enquiryReceiptCustomer(p: EnquiryReceiptCustomerPayload): string {
  return base(`
    ${h2("We've received your enquiry")}
    ${para(`Dear ${p.name},`)}
    ${para('Thank you for reaching out to MEI Bridal Couture. Our team will review your enquiry and be in touch within 1&ndash;2 business days.')}
    <div style="background:#faf8f5;border-left:3px solid #c9a465;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#555;margin:0;font-style:italic;">&ldquo;${p.message}&rdquo;</p>
    </div>
    ${para('<span style="font-size:13px;color:#888;">For urgent queries, please call or WhatsApp us directly.</span>')}
  `);
}

// ── Template: ENQUIRY_ADMIN_NOTIFICATION ─────────────────────────────────────

export interface EnquiryAdminNotificationPayload {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  occasion: string | null;
  budget: string | null;
  adminEnquiryUrl: string;
}

export function enquiryAdminNotification(p: EnquiryAdminNotificationPayload): string {
  const buttons = ctaButton('View Enquiry', p.adminEnquiryUrl) +
    (p.phone
      ? waButton(p.phone, p.name, `Hello ${p.name}, regarding your enquiry with MEI Bridal Couture`)
      : '');

  return base(`
    ${h2('New Enquiry')}
    ${metaTable([
      ['Name', p.name],
      ['Email', p.email],
      ['Phone', p.phone],
      ['Occasion', p.occasion],
      ['Budget', p.budget],
    ])}
    <div style="background:#faf8f5;border-left:3px solid #c9a465;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#555;margin:0;">${p.message}</p>
    </div>
    ${buttons}
  `);
}

// ── Template renderer (used by worker) ───────────────────────────────────────

export interface RenderResult {
  subject: string;
  html: string;
}

export function renderTemplate(type: NotificationType, payload: Record<string, unknown>): RenderResult {
  switch (type) {
    case 'ORDER_CONFIRMATION_CUSTOMER':
      return {
        subject: `Order confirmed — ${payload.orderNumber}`,
        html: orderConfirmationCustomer(payload as unknown as OrderConfirmationCustomerPayload),
      };
    case 'ORDER_CONFIRMATION_ADMIN':
      return {
        subject: `New order ${payload.orderNumber} from ${payload.customerName}`,
        html: orderConfirmationAdmin(payload as unknown as OrderConfirmationAdminPayload),
      };
    case 'ORDER_STATUS_UPDATE_CUSTOMER':
      return {
        subject: `Update on your order ${payload.orderNumber}`,
        html: orderStatusUpdateCustomer(payload as unknown as OrderStatusUpdateCustomerPayload),
      };
    case 'ENQUIRY_RECEIPT_CUSTOMER':
      return {
        subject: "We've received your enquiry — MEI Bridal Couture",
        html: enquiryReceiptCustomer(payload as unknown as EnquiryReceiptCustomerPayload),
      };
    case 'ENQUIRY_ADMIN_NOTIFICATION':
      return {
        subject: `New enquiry from ${payload.name}`,
        html: enquiryAdminNotification(payload as unknown as EnquiryAdminNotificationPayload),
      };
    default:
      // Fallback for unhandled notification types
      return {
        subject: 'Notification from MEI Bridal Couture',
        html: base(para('An unknown notification type was sent.')),
      };
  }
}
