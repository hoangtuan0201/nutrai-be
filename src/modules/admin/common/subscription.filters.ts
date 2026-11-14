import { Prisma, SubscriptionStatus } from '@prisma/client';

/** A user is PRO when they hold an ACTIVE, non-expired subscription on a paid plan. */
export function activeProSubscriptionWhere(now: Date = new Date()): Prisma.UserSubscriptionWhereInput {
  return {
    status: SubscriptionStatus.ACTIVE,
    expiresAt: { gt: now },
    plan: { price: { gt: 0 } },
  };
}

