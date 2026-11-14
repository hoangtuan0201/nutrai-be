import { Injectable } from '@nestjs/common';
import { BillingPeriod, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  getVietnamDateStringDaysAgo,
  getVietnamDayRange,
  getVietnamTodayString,
} from '../../../common/utils/date.util';
import { activeProSubscriptionWhere } from '../common/subscription.filters';

export interface RevenueByMethod {
  method: PaymentMethod;
  amount: number;
  transactions: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [users, revenue] = await Promise.all([this.getUserMetrics(), this.getRevenueMetrics()]);
    return { users, revenue, generatedAt: new Date().toISOString() };
  }

  /** New sign-ups today / this week (Mon-based) / this month, all in Asia/Ho_Chi_Minh. */
  private async getUserMetrics() {
    const { todayStart, weekStart, monthStart } = this.getVietnamPeriodStarts();
    const base = { deletedAt: null };

    const [total, newToday, newThisWeek, newThisMonth, proUsers] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { ...base, createdAt: { gte: weekStart } } }),
      this.prisma.user.count({ where: { ...base, createdAt: { gte: monthStart } } }),
      this.prisma.user.count({
        where: { ...base, subscriptions: { some: activeProSubscriptionWhere() } },
      }),
    ]);

    return { total, newToday, newThisWeek, newThisMonth, proUsers, freeUsers: total - proUsers };
  }

  /**
   * MRR = sum of monthly-normalized price of every active paid subscription
   * (yearly plans are divided by 12). ARR = MRR × 12.
   * Collected revenue = COMPLETED payments grouped by gateway (SePay / Stripe).
   */
  private async getRevenueMetrics() {
    const { monthStart } = this.getVietnamPeriodStarts();
    const [mrr, collectedThisMonth, collectedAllTime] = await Promise.all([
      this.calculateMrr(),
      this.sumCompletedPaymentsByMethod(monthStart),
      this.sumCompletedPaymentsByMethod(),
    ]);

    return {
      currency: 'VND',
      mrr,
      arr: mrr * 12,
      collectedThisMonth,
      collectedAllTime,
    };
  }

  private async calculateMrr(): Promise<number> {
    const grouped = await this.prisma.userSubscription.groupBy({
      by: ['planId'],
      where: activeProSubscriptionWhere(),
      _count: { _all: true },
    });
    if (grouped.length === 0) return 0;

    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { id: { in: grouped.map((g) => g.planId) } },
      select: { id: true, price: true, billingPeriod: true },
    });
    const planById = new Map(plans.map((p) => [p.id, p]));

    const mrr = grouped.reduce((sum, g) => {
      const plan = planById.get(g.planId);
      if (!plan) return sum;
      const monthly = plan.billingPeriod === BillingPeriod.YEARLY ? plan.price / 12 : plan.price;
      return sum + monthly * g._count._all;
    }, 0);
    return Math.round(mrr);
  }

  private async sumCompletedPaymentsByMethod(since?: Date) {
    const grouped = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: {
        status: PaymentStatus.COMPLETED,
        ...(since ? { paidAt: { gte: since } } : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const byMethod: RevenueByMethod[] = grouped.map((g) => ({
      method: g.paymentMethod,
      amount: g._sum.amount ?? 0,
      transactions: g._count._all,
    }));
    const total = byMethod.reduce((sum, m) => sum + m.amount, 0);
    return { total, byMethod };
  }

  private getVietnamPeriodStarts() {
    const todayStr = getVietnamTodayString();
    const [year, month, day] = todayStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const monthStr = `${year}-${String(month).padStart(2, '0')}-01`;

    return {
      todayStart: getVietnamDayRange(todayStr).startUtc,
      weekStart: getVietnamDayRange(getVietnamDateStringDaysAgo(daysSinceMonday)).startUtc,
      monthStart: getVietnamDayRange(monthStr).startUtc,
    };
  }
}

