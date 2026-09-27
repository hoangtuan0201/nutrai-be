import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetRequestedEvent } from './password-reset-requested.event';

/**
 * PasswordResetRequestedHandler
 *
 * Handles the PasswordResetRequestedEvent asynchronously.
 * This handler runs AFTER the HTTP response has already been sent —
 * the user never waits for the email to be delivered.
 *
 * Production: replace the logger.log() block with a real email service
 * (Nodemailer, SendGrid, AWS SES, Resend, etc.)
 */
@EventsHandler(PasswordResetRequestedEvent)
export class PasswordResetRequestedHandler
  implements IEventHandler<PasswordResetRequestedEvent>
{
  private readonly logger = new Logger(PasswordResetRequestedHandler.name);

  constructor(private readonly config: ConfigService) {}

  async handle(event: PasswordResetRequestedEvent): Promise<void> {
    const { email, resetToken, expiresAt } = event;

    const minutesLeft = Math.round(
      (expiresAt.getTime() - Date.now()) / 60_000,
    );

    const baseUrl = this.config.get<string>('auth.appBaseUrl');
    const resetPath = this.config.get<string>('auth.appResetPasswordPath');
    const resetLink = `${baseUrl}${resetPath}?token=${resetToken}`;

    // ─── [DEV] Mock — log to console ──────────────────────────────
    this.logger.log(
      `[MOCK EMAIL] To: ${email}\n` +
      `Subject: Reset your NutraAI password\n` +
      `Body: Click the link below to reset your password (valid for ${minutesLeft} minutes):\n` +
      `${resetLink}`,
    );

    // ─── [PROD] Real email — uncomment and inject your email service ─
    // try {
    //   await this.emailService.send({
    //     to: email,
    //     subject: 'Reset your NutraAI password',
    //     template: 'password-reset',
    //     context: { resetLink, minutesLeft },
    //   });
    // } catch (error) {
    //   this.logger.error(`Failed to send reset email to ${email}`, error);
    //   // Do NOT re-throw — we never want email failure to crash the process
    // }
  }
}
