import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BillingPeriod,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class PaymentsRepository {
  private readonly logger = new Logger(PaymentsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures default SubscriptionPlans (Free, Pro Monthly, Pro Yearly) exist in DB.
   */
  async ensureDefaultPlans() {
    const existing = await this.prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    if (existing.length === 0) {
      this.logger.log('Seeding default SubscriptionPlans (Free, Pro Monthly, Pro Yearly)...');
      await this.prisma.subscriptionPlan.createMany({
        data: [
          {
            name: 'Free',
            description: 'Basic nutrition tracking with limited AI features',
            price: 0,
            currency: 'VND',
            billingPeriod: BillingPeriod.MONTHLY,
            features: {
              maxMealsPerDay: 5,
              aiAnalysisPerDay: 3,
              aiChatPerDay: 5,
              exportReports: false,
              advancedInsights: false,
            },
            sortOrder: 1,
          },
          {
            name: 'Pro Monthly',
            description: 'Unlimited AI food scanning, AI Coach, and advanced insights',
            price: 49000,
            currency: 'VND',
            billingPeriod: BillingPeriod.MONTHLY,
            features: {
              maxMealsPerDay: -1,
              aiAnalysisPerDay: 20,
              aiChatPerDay: 50,
              exportReports: true,
              advancedInsights: true,
              prioritySupport: true,
            },
            sortOrder: 2,
          },
          {
            name: 'Pro Yearly',
            description: 'All Pro features billed yearly (save 15%)',
            price: 399000,
            currency: 'VND',
            billingPeriod: BillingPeriod.YEARLY,
            features: {
              maxMealsPerDay: -1,
              aiAnalysisPerDay: 20,
              aiChatPerDay: 50,
              exportReports: true,
              advancedInsights: true,
              prioritySupport: true,
            },
            sortOrder: 3,
          },
        ],
        skipDuplicates: true,
      });

      return this.prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return existing.filter((p) => p.isActive);
  }

  async findPlanByIdOrPeriod(planId?: string, billingPeriod: BillingPeriod = BillingPeriod.MONTHLY) {
    await this.ensureDefaultPlans();

    if (planId) {
      const byId = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (byId) return byId;
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        isActive: true,
        billingPeriod,
        price: { gt: 0 },
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (!plan) {
      throw new NotFoundException(`No active Pro SubscriptionPlan found for ${billingPeriod}`);
    }

    return plan;
  }

  async findActiveSubscription(userId: string) {
    const now = new Date();
    return this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
  }

  async createPendingPayment(data: {
    userId: string;
    planId: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    paymentCode: string;
    expiresAt: Date;
  }) {
    return this.prisma.payment.create({
      data: {
        userId: data.userId,
        planId: data.planId,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        status: PaymentStatus.PENDING,
        transactionId: data.paymentCode,
        paymentCode: data.paymentCode,
        expiresAt: data.expiresAt,
      },
      include: {
        plan: true,
      },
    });
  }

  async findPaymentById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        plan: true,
        subscription: { include: { plan: true } },
      },
    });
  }

  async findPaymentByCode(code: string) {
    const normalized = code.trim().toUpperCase();
    return this.prisma.payment.findFirst({
      where: {
        OR: [
          { paymentCode: { equals: normalized, mode: 'insensitive' } },
          { transactionId: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestPendingSePayPayment() {
    return this.prisma.payment.findFirst({
      where: {
        paymentMethod: PaymentMethod.SEPAY,
        status: PaymentStatus.PENDING,
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEventByEventId(eventId: string) {
    return this.prisma.paymentEvent.findUnique({
      where: { eventId },
    });
  }

  async findPaymentByProviderTxId(providerTxId: string) {
    return this.prisma.payment.findUnique({
      where: { providerTxId },
      include: { plan: true, subscription: true },
    });
  }

  async recordPaymentEvent(data: {
    paymentId?: string | null;
    provider: string;
    eventId: string;
    eventType: string;
    payload: Record<string, any>;
    status: 'PROCESSED' | 'IGNORED' | 'FAILED';
    errorMessage?: string;
  }) {
    return this.prisma.paymentEvent.upsert({
      where: { eventId: data.eventId },
      update: {
        paymentId: data.paymentId ?? undefined,
        status: data.status,
        errorMessage: data.errorMessage,
        processedAt: new Date(),
      },
      create: {
        paymentId: data.paymentId ?? null,
        provider: data.provider,
        eventId: data.eventId,
        eventType: data.eventType,
        payload: data.payload,
        status: data.status,
        errorMessage: data.errorMessage,
      },
    });
  }

  async cancelPendingPaymentsForUser(userId: string) {
    return this.prisma.payment.updateMany({
      where: {
        userId,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.EXPIRED,
      },
    });
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
  }

  async findUserRecentPayments(userId: string, limit = 10) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

