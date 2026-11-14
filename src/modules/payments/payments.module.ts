import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { SePayProvider } from './providers/sepay.provider';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, AiModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    PaymentProcessingService,
    SePayProvider,
    StripeProvider,
  ],
  exports: [PaymentsService, PaymentsRepository, PaymentProcessingService],
})
export class PaymentsModule {}
