import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { PasswordResetRequestedEvent } from './password-reset-requested.event';

/**
 * PasswordResetRequestedHandler
 *
 * Handles the PasswordResetRequestedEvent asynchronously.
 * Sends a NutrAI Warm Botanical Editorial HTML email via Gmail SMTP.
 */
@EventsHandler(PasswordResetRequestedEvent)
export class PasswordResetRequestedHandler
  implements IEventHandler<PasswordResetRequestedEvent>
{
  private readonly logger = new Logger(PasswordResetRequestedHandler.name);

  constructor(private readonly mailService: MailService) {}

  async handle(event: PasswordResetRequestedEvent): Promise<void> {
    const { email, resetToken, expiresAt, name } = event;
    const minutesLeft = Math.max(
      1,
      Math.round((expiresAt.getTime() - Date.now()) / 60_000),
    );

    try {
      await this.mailService.sendPasswordReset({
        to: email,
        name,
        code: resetToken,
        expiresMinutes: minutesLeft,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send reset email to ${email}`,
        (error as Error).stack,
      );
    }
  }
}
