import { Resend } from 'resend';
import type { EmailMessage, EmailProvider, EmailResult } from '../provider.js';

/**
 * Resend email provider for production
 * Sends emails via Resend API
 */
export class ResendProvider implements EmailProvider {
  private client: Resend;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.client = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const response = await this.client.emails.send({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        replyTo: message.replyTo,
      });

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
        };
      }

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error sending email';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
