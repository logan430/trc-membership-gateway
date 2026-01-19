import { env } from '../config/env.js';
import { ConsoleProvider } from './providers/console.js';
import { ResendProvider } from './providers/resend.js';

/**
 * Email message structure for sending
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

/**
 * Result of an email send operation
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email provider interface for abstracting email delivery
 */
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}

/**
 * Factory function to create the configured email provider
 * - Returns ConsoleProvider for development (logs instead of sending)
 * - Returns ResendProvider for production (sends via Resend API)
 */
export function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      // RESEND_API_KEY is guaranteed to exist when EMAIL_PROVIDER is 'resend' (validated by env schema)
      return new ResendProvider(env.RESEND_API_KEY!, env.EMAIL_FROM_ADDRESS);
    case 'console':
    default:
      return new ConsoleProvider();
  }
}
