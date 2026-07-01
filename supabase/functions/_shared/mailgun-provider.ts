import type { EmailProvider, SendOptions } from './notification-types.ts';

// Mailgun's /messages endpoint returns { id, message }
interface MailgunResponse {
  id: string;
  message: string;
}

export class MailgunProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly domain: string;
  private readonly from: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = Deno.env.get('MAILGUN_API_KEY');
    const domain = Deno.env.get('MAILGUN_DOMAIN') ??
      (Deno.env.get('ENVIRONMENT') === 'staging'
        ? Deno.env.get('MAILGUN_SANDBOX_DOMAIN')
        : undefined);

    if (!apiKey) throw new Error('MAILGUN_API_KEY is not set');
    if (!domain) throw new Error('MAILGUN_DOMAIN is not set');

    this.apiKey = apiKey;
    this.domain = domain;
    this.from = Deno.env.get('MAILGUN_FROM') ?? `MEI Bridal Couture <noreply@${domain}>`;
    this.baseUrl = Deno.env.get('MAILGUN_BASE_URL') ?? 'https://api.mailgun.net';
  }

  async send(opts: SendOptions): Promise<string> {
    const form = new FormData();
    form.append('from', this.from);
    form.append('to', opts.to);
    form.append('subject', opts.subject);
    form.append('html', opts.html);

    const res = await fetch(`${this.baseUrl}/v3/${this.domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`api:${this.apiKey}`)}`,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      throw new Error(`Mailgun ${res.status} ${res.statusText}: ${body}`);
    }

    const json = await res.json() as MailgunResponse;
    // Mailgun message IDs come wrapped in angle brackets: <abc@domain>
    return json.id.replace(/^<|>$/g, '');
  }
}
