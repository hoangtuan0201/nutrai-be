import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BillingPeriod, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { CheckoutPaymentMethod, CreateCheckoutDto } from './dto/create-checkout.dto';
import { SePayWebhookDto } from './dto/sepay-webhook.dto';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentsRepository } from './payments.repository';
import { SePayProvider } from './providers/sepay.provider';
import { StripeProvider } from './providers/stripe.provider';
import { AiQuotaService } from '../ai/ai-quota.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly repo: PaymentsRepository,
    private readonly sepayProvider: SePayProvider,
    private readonly stripeProvider: StripeProvider,
    private readonly processingService: PaymentProcessingService,
    private readonly aiQuotaService: AiQuotaService,
  ) {}

  /**
   * Generates a unique alphanumeric payment code (e.g. `NUTRAM8L4KJ2F1A`).
   * Combines timestamp base36 and crypto random bytes to guarantee uniqueness while staying compact for VietQR/SePay.
   */
  generatePaymentCode(): string {
    const timePart = Date.now().toString(36).toUpperCase();
    const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `NUTRA${timePart}${randPart}`;
  }

  /**
   * Lists all active Subscription Plans (`Free`, `Pro Monthly`, `Pro Yearly`).
   */
  async getPlans() {
    return this.repo.ensureDefaultPlans();
  }

  /**
   * Returns current user's subscription status, plan details, and recent payment history.
   */
  async getMySubscription(userId: string) {
    const [activeSub, recentPayments, plans, aiQuota] = await Promise.all([
      this.repo.findActiveSubscription(userId),
      this.repo.findUserRecentPayments(userId, 5),
      this.repo.ensureDefaultPlans(),
      this.aiQuotaService.getUserDailyQuota(userId),
    ]);

    const freePlan = plans.find((p) => p.price === 0) ?? null;
    const currentPlan = activeSub?.plan ?? freePlan;

    return {
      isPro: Boolean(activeSub),
      planName: activeSub ? activeSub.plan.name : 'Free Plan',
      subscription: activeSub
        ? {
            id: activeSub.id,
            status: activeSub.status,
            startsAt: activeSub.startsAt,
            expiresAt: activeSub.expiresAt,
            plan: activeSub.plan,
          }
        : null,
      features: currentPlan?.features ?? {
        maxMealsPerDay: 5,
        aiAnalysisPerDay: 3,
        aiChatPerDay: 5,
        exportReports: false,
        advancedInsights: false,
      },
      aiQuota,
      recentPayments,
    };
  }

  /**
   * Step 1 - Step 3 of Payment Flow:
   * Creates a PENDING Payment and returns VietQR transfer instructions (SePay)
   * or Checkout Session URL (Stripe).
   */
  async createCheckout(userId: string, dto: CreateCheckoutDto) {
    const method = dto.paymentMethod ?? CheckoutPaymentMethod.SEPAY;
    const plan = await this.repo.findPlanByIdOrPeriod(
      dto.planId,
      dto.billingPeriod ?? BillingPeriod.MONTHLY,
    );

    const paymentCode = dto.customPaymentCode
      ? dto.customPaymentCode.trim().toUpperCase()
      : this.generatePaymentCode();

    // QR expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Auto-expire any previous PENDING checkout of this user so only 1 active checkout exists
    await this.repo.cancelPendingPaymentsForUser(userId);

    const payment = await this.repo.createPendingPayment({
      userId,
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency || 'VND',
      paymentMethod: method === CheckoutPaymentMethod.STRIPE ? PaymentMethod.STRIPE : PaymentMethod.SEPAY,
      paymentCode,
      expiresAt,
    });

    if (method === CheckoutPaymentMethod.STRIPE) {
      const user = await this.repo.findUserById(userId);
      const stripeSession = await this.stripeProvider.createCheckoutSession({
        paymentId: payment.id,
        paymentCode,
        userId,
        userEmail: user?.email,
        planName: plan.name,
        amount: payment.amount,
        currency: payment.currency,
      });

      return {
        paymentId: payment.id,
        paymentCode,
        status: payment.status,
        paymentMethod: 'STRIPE',
        amount: payment.amount,
        currency: payment.currency,
        expiresAt: payment.expiresAt,
        plan,
        stripe: stripeSession,
      };
    }

    // Default: SePay VietQR
    const qrInfo = this.sepayProvider.generateQr({
      amount: payment.amount,
      paymentCode,
    });

    return {
      paymentId: payment.id,
      paymentCode,
      status: payment.status,
      paymentMethod: 'SEPAY',
      amount: payment.amount,
      currency: payment.currency,
      expiresAt: payment.expiresAt,
      plan,
      sepay: qrInfo,
    };
  }

  /**
   * Checks status of a Payment.
   * If still PENDING and paymentMethod is SEPAY, actively queries SePay User API v2
   * to reconcile immediately even if a webhook hasn't arrived yet.
   */
  async getPaymentStatus(userId: string, paymentId: string) {
    let payment = await this.repo.findPaymentById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId && payment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    if (payment.status === PaymentStatus.PENDING && payment.paymentMethod === PaymentMethod.SEPAY) {
      const code = payment.paymentCode ?? payment.transactionId;
      const minAmount = payment.amount;
      const matchedTx = await this.sepayProvider.findMatchingTransaction(code, minAmount);

      if (matchedTx) {
        await this.processingService.processSePayTransaction(matchedTx);
        payment = (await this.repo.findPaymentById(paymentId))!;
      }
    }

    return {
      paymentId: payment.id,
      paymentCode: payment.paymentCode ?? payment.transactionId,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      expiresAt: payment.expiresAt,
      plan: payment.plan,
      subscription: payment.subscription,
      sepay:
        payment.paymentMethod === PaymentMethod.SEPAY
          ? this.sepayProvider.generateQr({
              amount: payment.amount,
              paymentCode: payment.paymentCode ?? payment.transactionId,
            })
          : undefined,
    };
  }

  /**
   * Explicitly cancels a pending payment on user request (e.g. from Floating Pending Widget).
   */
  async cancelPayment(userId: string, paymentId: string) {
    const payment = await this.repo.findPaymentById(paymentId);
    if (!payment || (payment.userId && payment.userId !== userId)) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === PaymentStatus.PENDING) {
      await this.repo.updatePaymentStatus(paymentId, PaymentStatus.EXPIRED);
    }
    return {
      success: true,
      message: 'Payment cancelled successfully',
    };
  }

  /**
   * Step 6 - Step 8 of SePay VietQR Flow:
   * Handles incoming webhook from SePay.
   */
  async handleSePayWebhook(payload: SePayWebhookDto | Record<string, any>, authHeader?: string) {
    this.sepayProvider.verifyWebhookAuth(authHeader);
    const normalized = this.sepayProvider.normalizeWebhookPayload(payload);
    this.logger.log(
      `📥 Received SePay Webhook: eventId=${normalized.eventId}, amount=${normalized.amount}, content="${normalized.content}"`,
    );

    const result = await this.processingService.processSePayTransaction(normalized);
    return {
      ...result,
      success: true,
    };
  }

  /**
   * Handles incoming webhook from Stripe.
   */
  async handleStripeWebhook(
    payload: Record<string, any>,
    rawBody?: string,
    stripeSignature?: string,
  ) {
    const normalized = this.stripeProvider.verifyAndNormalizeWebhook(
      payload,
      rawBody,
      stripeSignature,
    );
    this.logger.log(
      `📥 Received Stripe Webhook: eventId=${normalized.eventId}, type=${normalized.eventType}`,
    );

    const result = await this.processingService.processStripeEvent(normalized);
    return {
      received: true,
      ...result,
    };
  }

  /**
   * Actively pulls the latest transactions from SePay User API v2 (`GET /v2/transactions`)
   * and processes any matching PENDING payments.
   */
  async syncSePayTransactions() {
    const transactions = await this.sepayProvider.fetchTransactions(20);
    const processed: any[] = [];

    for (const tx of transactions) {
      if (tx.transferType === 'in' && tx.amount > 0) {
        const res = await this.processingService.processSePayTransaction(tx);
        processed.push({
          eventId: tx.eventId,
          referenceCode: tx.referenceCode,
          amount: tx.amount,
          content: tx.content,
          result: res,
        });
      }
    }

    return {
      totalFetched: transactions.length,
      processed,
    };
  }

  /**
   * Returns live SePay bank accounts and webhook configurations from SePay User API v2.
   */
  async getSePayGatewayDiagnostics() {
    const [bankAccounts, webhooks, recentTransactions] = await Promise.all([
      this.sepayProvider.fetchBankAccounts(),
      this.sepayProvider.fetchWebhooks(),
      this.sepayProvider.fetchTransactions(5),
    ]);

    return {
      bankAccounts,
      webhooks,
      recentTransactions,
      stripeConfigured: this.stripeProvider.isConfigured(),
    };
  }
}
