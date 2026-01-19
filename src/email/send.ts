import { createEmailProvider, type EmailResult } from './provider.js';

/**
 * Singleton email provider instance
 * Created once at module load, uses the configured provider (console or resend)
 */
export const emailProvider = createEmailProvider();

/**
 * Test email connection by sending a test message
 * For manual testing only - not wired to any route
 */
export async function testEmailConnection(): Promise<EmailResult> {
  return emailProvider.send({
    to: 'test@example.com',
    subject: 'Email System Test',
    text: 'If you receive this, the email system is working.',
  });
}
