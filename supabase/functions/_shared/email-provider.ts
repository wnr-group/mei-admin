// Provider interface + factory. Swap the import in createEmailProvider()
// to migrate away from Mailgun without touching callers.

import type { EmailProvider, SendOptions } from './notification-types.ts';
import { MailgunProvider } from './mailgun-provider.ts';

export type { EmailProvider, SendOptions };

export function createEmailProvider(): EmailProvider {
  const env = Deno.env.get('ENVIRONMENT') ?? 'development';
  const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';

  if (!enabled || env === 'development') {
    // In development or when disabled, log and no-op
    return {
      async send(opts) {
        console.log(JSON.stringify({
          level: 'info',
          service: 'email-provider',
          mode: 'noop',
          to: opts.to,
          subject: opts.subject,
        }));
        return `noop-${crypto.randomUUID()}`;
      },
    };
  }

  return new MailgunProvider();
}
