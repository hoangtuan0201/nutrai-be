import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { EmailVerificationRequestedEvent } from './email-verification-requested.event';

@EventsHandler(EmailVerificationRequestedEvent)
export class EmailVerificationRequestedHandler
  implements IEventHandler<EmailVerificationRequestedEvent>
{
  private readonly logger = new Logger(EmailVerificationRequestedHandler.name);

  constructor(private readonly mailService: MailService) {}

  async handle(event: EmailVerificationRequestedEvent): Promise<void> {
    const minutesLeft = Math.max(
      1,
      Math.round((event.expiresAt.getTime() - Date.now()) / 60_000),
    );

    try {
      await this.mailService.sendEmailVerification({
        to: event.email,
        name: event.name,
        code: event.code,
        expiresMinutes: minutesLeft,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${event.email}`,
        (error as Error).stack,
      );
    }
  }
}

