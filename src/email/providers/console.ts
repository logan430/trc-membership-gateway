import { logger } from '../../index.js';
import type { EmailMessage, EmailProvider, EmailResult } from '../provider.js';

/**
 * Console email provider for development
 * Logs email details instead of sending - useful for testing without external dependencies
 */
export class ConsoleProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailResult> {
    const messageId = `console-${Date.now()}`;

    logger.info({
      provider: 'console',
      messageId,
      to: message.to,
      subject: message.subject,
      textLength: message.text.length,
      replyTo: message.replyTo,
    }, 'Email logged (console provider)');

    logger.debug({
      messageId,
      text: message.text,
    }, 'Email content');

    return {
      success: true,
      messageId,
    };
  }
}
