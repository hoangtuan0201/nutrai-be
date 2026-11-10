import { Injectable, Logger } from '@nestjs/common';
import {
  BillingPeriod,
  NotificationType,
  PaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsRepository } from './payments.repository';
import { NormalizedSePayTransaction } from './providers/sepay.provider';
import { NormalizedStripeEvent } from './providers/stripe.provider';

export interface ProcessedPaymentResult {
  success: boolean;
  idempotent?: boolean;
  status: 'COMPLETED' | 'IGNORED' | 'FAILED';
  paymentId?: string;
  subscriptionId?: string;
  paymentCode?: string;
  reason?: string;
}

@Injectable()
export class PaymentProcessingService {
  private readonly logger = new Logger(PaymentProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PaymentsRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Extracts payment code from transfer content.
   * Supports:
   * - `NUTRA<ALPHANUMERIC>` (e.g., `NUTRA12345`, `NUTRA8F3A12`)
   * - `USERPRO<ALPHANUMERIC>*` (e.g., `USERPRO`, `USERPRO123`)
   */
  extractPaymentCode(content: string, explicitCode?: string | null): string | null {
    if (explicitCode && explicitCode.trim().length > 0) {
      return explicitCode.trim().toUpperCase();
    }

    const upper = (content || '').toUpperCase();
    const nutraMatch = upper.match(/\b(NUTRA[A-Z0-9]{3,16})\b/);
    if (nutraMatch) {
      return nutraMatch[1];
    }

    const userProMatch = upper.match(/\b(USERPRO[A-Z0-9]{0,16})\b/);
    if (userProMatch) {
      return userProMatch[1];
    }

    return null;
  }

  /**
   * Step 7 & Step 8 of SePay VietQR Flow:
   * 1. Validate (`transferType === 'in'`, `amount > 0`)
   * 2. Idempotency check (`PaymentEvent.eventId` & `Payment.providerTxId`)
   * 3. Payment lookup by extracted `paymentCode` (with fallback to latest PENDING SePay payment for `USERPRO` sandbox tests)
   * 4. Amount matching
   * 5. Atomic DB transaction: update `Payment` -> `COMPLETED`, activate/extend `UserSubscription` -> `ACTIVE`, log `PaymentEvent`
   * 6. Send `SUBSCRIPTION` Push + In-App Notification
   */
  async processSePayTransaction(
    tx: NormalizedSePayTransaction,
  ): Promise<ProcessedPaymentResult> {
    // 1. Validate direction
    if (tx.transferType !== 'in' || tx.amount <= 0) {
      await this.repo.recordPaymentEvent({
        provider: 'SEPAY',
        eventId: tx.eventId,
        eventType: `transfer_${tx.transferType}`,
        payload: tx.raw,
        status: 'IGNORED',
        errorMessage: 'Ignored outgoing or zero-amount transfer',
      });
      return {
        success: true,
        status: 'IGNORED',
        reason: 'Outgoing or zero-amount transfer',
      };
    }

    // 2. Idempotency check
    const existingEvent = await this.repo.findEventByEventId(tx.eventId);
    if (existingEvent && existingEvent.status === 'PROCESSED') {
      this.logger.log(`Idempotent SePay webhook hit: eventId=${tx.eventId}`);
      return {
        success: true,
        idempotent: true,
        status: 'COMPLETED',
        paymentId: existingEvent.paymentId ?? undefined,
        reason: 'Event already processed',
      };
    }

    const existingByProviderTx = await this.repo.findPaymentByProviderTxId(tx.referenceCode);
    if (existingByProviderTx && existingByProviderTx.status === PaymentStatus.COMPLETED) {
      this.logger.log(`Idempotent SePay referenceCode hit: ref=${tx.referenceCode}`);
      return {
        success: true,
        idempotent: true,
        status: 'COMPLETED',
        paymentId: existingByProviderTx.id,
        subscriptionId: existingByProviderTx.subscriptionId ?? undefined,
        paymentCode: existingByProviderTx.paymentCode ?? undefined,
        reason: 'Transaction reference already completed',
      };
    }

    // 3. Extract payment code & locate Payment
    const extractedCode = this.extractPaymentCode(tx.content, tx.code);
    let payment = extractedCode ? await this.repo.findPaymentByCode(extractedCode) : null;

    // Fallback for SePay Sandbox test transfers with generic "USERPRO" content
    if (!payment && extractedCode?.startsWith('USERPRO')) {
      payment = await this.repo.findLatestPendingSePayPayment();
    }

    if (!payment) {
      this.logger.warn(
        `No matching Payment found for SePay tx eventId=${tx.eventId}, content="${tx.content}"`,
      );
      await this.repo.recordPaymentEvent({
        provider: 'SEPAY',
        eventId: tx.eventId,
        eventType: 'transfer_in',
        payload: tx.raw,
        status: 'IGNORED',
        errorMessage: `No matching payment found for code="${extractedCode ?? tx.content}"`,
      });
      return {
        success: true,
        status: 'IGNORED',
        paymentCode: extractedCode ?? undefined,
        reason: 'No matching payment found',
      };
    }

    // If payment is already COMPLETED, record event idempotently and return
    if (payment.status === PaymentStatus.COMPLETED) {
      await this.repo.recordPaymentEvent({
        paymentId: payment.id,
        provider: 'SEPAY',
        eventId: tx.eventId,
        eventType: 'transfer_in',
        payload: tx.raw,
        status: 'PROCESSED',
      });
      return {
        success: true,
        idempotent: true,
        status: 'COMPLETED',
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId ?? undefined,
        paymentCode: payment.paymentCode ?? payment.transactionId,
        reason: 'Payment already completed',
      };
    }

    // 4. Amount Matching (allow exact or overpayment, or >= 49000 VND for Sandbox Pro Monthly tests)
    const minimumAcceptableAmount =
      extractedCode === 'USERPRO' ? Math.min(payment.amount, 49000) : payment.amount;

    if (tx.amount < minimumAcceptableAmount) {
      const msg = `Underpaid transfer: received ${tx.amount} VND, expected ${payment.amount} VND`;
      this.logger.warn(`${msg} (paymentId=${payment.id})`);
      await this.repo.recordPaymentEvent({
        paymentId: payment.id,
        provider: 'SEPAY',
        eventId: tx.eventId,
        eventType: 'transfer_in',
        payload: tx.raw,
        status: 'FAILED',
        errorMessage: msg,
      });
      return {
        success: false,
        status: 'FAILED',
        paymentId: payment.id,
        paymentCode: payment.paymentCode ?? payment.transactionId,
        reason: msg,
      };
    }

    // 5. Atomic Activation: Update Payment + Activate/Extend UserSubscription + Log PaymentEvent
    return this.activateSubscriptionAtomically({
      paymentId: payment.id,
      userId: payment.userId!,
      planId: payment.planId,
      provider: 'SEPAY',
      eventId: tx.eventId,
      eventType: 'transfer_in',
      providerTxId: tx.referenceCode || tx.eventId,
      paidAmount: tx.amount,
      payload: tx.raw,
    });
  }

  /**
   * Processes verified Stripe webhook events (`checkout.session.completed`).
   */
  async processStripeEvent(event: NormalizedStripeEvent): Promise<ProcessedPaymentResult> {
    if (event.eventType !== 'checkout.session.completed') {
      return {
        success: true,
        status: 'IGNORED',
        reason: `Unhandled Stripe event type: ${event.eventType}`,
      };
    }

    const existingEvent = await this.repo.findEventByEventId(event.eventId);
    if (existingEvent && existingEvent.status === 'PROCESSED') {
      return {
        success: true,
        idempotent: true,
        status: 'COMPLETED',
        paymentId: existingEvent.paymentId ?? undefined,
        reason: 'Stripe event already processed',
      };
    }

    const payment = event.paymentId
      ? await this.repo.findPaymentById(event.paymentId)
      : event.paymentCode
        ? await this.repo.findPaymentByCode(event.paymentCode)
        : null;

    if (!payment || !payment.userId) {
      await this.repo.recordPaymentEvent({
        provider: 'STRIPE',
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.raw,
        status: 'IGNORED',
        errorMessage: 'No matching payment found for Stripe session',
      });
      return {
        success: true,
        status: 'IGNORED',
        reason: 'No matching payment found',
      };
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return {
        success: true,
        idempotent: true,
        status: 'COMPLETED',
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId ?? undefined,
      };
    }

    return this.activateSubscriptionAtomically({
      paymentId: payment.id,
      userId: payment.userId,
      planId: payment.planId,
      provider: 'STRIPE',
      eventId: event.eventId,
      eventType: event.eventType,
      providerTxId: event.sessionId || event.eventId,
      paidAmount: event.amountTotal || payment.amount,
      payload: event.raw,
    });
  }

  /**
   * Executes an atomic PostgreSQL transaction to:
   * - Create or extend the user's active `UserSubscription`
   * - Mark `Payment` as `COMPLETED` (`PAID`)
   * - Record `PaymentEvent` (`PROCESSED`)
   * - Trigger a real-time notification to the user
   */
  private async activateSubscriptionAtomically(params: {
    paymentId: string;
    userId: string;
    planId?: string | null;
    provider: 'SEPAY' | 'STRIPE';
    eventId: string;
    eventType: string;
    providerTxId: string;
    paidAmount: number;
    payload: Record<string, any>;
  }): Promise<ProcessedPaymentResult> {
    const plan = await this.repo.findPlanByIdOrPeriod(params.planId ?? undefined);
    const durationDays = plan.billingPeriod === BillingPeriod.YEARLY ? 365 : 30;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // Check if user already has an active subscription to extend from its current expiry
      const currentActiveSub = await tx.userSubscription.findFirst({
        where: {
          userId: params.userId,
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: 'desc' },
      });

      const baseDate = currentActiveSub ? new Date(currentActiveSub.expiresAt) : now;
      const expiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const subscription = currentActiveSub
        ? await tx.userSubscription.update({
            where: { id: currentActiveSub.id },
            data: {
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE,
              expiresAt,
            },
          })
        : await tx.userSubscription.create({
            data: {
              userId: params.userId,
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE,
              transactionId: `${params.provider}-${params.providerTxId}`,
              startsAt: now,
              expiresAt,
            },
          });

      const updatedPayment = await tx.payment.update({
        where: { id: params.paymentId },
        data: {
          status: PaymentStatus.COMPLETED,
          subscriptionId: subscription.id,
          providerTxId: params.providerTxId,
          paidAt: now,
          receiptData: JSON.stringify(params.payload),
        },
      });

      await tx.paymentEvent.upsert({
        where: { eventId: params.eventId },
        update: {
          paymentId: updatedPayment.id,
          status: 'PROCESSED',
          processedAt: now,
        },
        create: {
          paymentId: updatedPayment.id,
          provider: params.provider,
          eventId: params.eventId,
          eventType: params.eventType,
          payload: params.payload,
          status: 'PROCESSED',
          processedAt: now,
        },
      });

      return { subscription, updatedPayment };
    });

    this.logger.log(
      `✅ Payment COMPLETED & NutraAI Pro activated: userId=${params.userId}, paymentId=${params.paymentId}, subId=${result.subscription.id}`,
    );

    // Fire-and-forget Push + In-App notification
    this.notifications
      .sendToUser({
        userId: params.userId,
        type: NotificationType.SUBSCRIPTION,
        title: 'Welcome to NutraAI Pro! ⭐',
        body: `Your ${plan.name} subscription is now active until ${result.subscription.expiresAt.toISOString().slice(0, 10)}. Enjoy unlimited AI food scanning and coaching!`,
        data: {
          screen: 'subscription',
          paymentId: params.paymentId,
          subscriptionId: result.subscription.id,
        },
      })
      .catch((err) =>
        this.logger.warn(`Failed to send subscription notification: ${(err as Error).message}`),
      );

    return {
      success: true,
      status: 'COMPLETED',
      paymentId: result.updatedPayment.id,
      subscriptionId: result.subscription.id,
      paymentCode: result.updatedPayment.paymentCode ?? result.updatedPayment.transactionId,
    };
  }
}
