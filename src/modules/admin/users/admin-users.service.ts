import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserProfile } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ageFromDob, calculateBMR, calculateTDEE } from '../../profile/nutrition-calculator';
import { toPaginated, toSkipTake } from '../common/pagination';
import { activeProSubscriptionWhere } from '../common/subscription.filters';
import { QueryAdminUsersDto, UserPlanFilter } from './dto/query-admin-users.dto';

const USER_LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  authProvider: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: QueryAdminUsersDto) {
    const now = new Date();
    const where = this.buildListWhere(query, now);

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_LIST_SELECT,
          subscriptions: {
            where: activeProSubscriptionWhere(now),
            orderBy: { expiresAt: 'desc' },
            take: 1,
            select: { expiresAt: true, plan: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query.page, query.limit),
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rows.map(({ subscriptions, ...user }) => ({
      ...user,
      plan: subscriptions.length > 0 ? UserPlanFilter.PRO : UserPlanFilter.FREE,
      proPlanName: subscriptions[0]?.plan.name ?? null,
      proExpiresAt: subscriptions[0]?.expiresAt ?? null,
    }));
    return toPaginated(items, total, query.page, query.limit);
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        ...USER_LIST_SELECT,
        emailVerified: true,
        profile: true,
        nutritionTargets: { where: { isActive: true }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
        subscriptions: {
          orderBy: { expiresAt: 'desc' },
          take: 5,
          include: { plan: { select: { name: true, price: true, billingPeriod: true } } },
        },
        weightLogs: { orderBy: { loggedDate: 'desc' }, take: 1 },
        _count: { select: { meals: true, payments: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { profile, nutritionTargets, weightLogs, ...rest } = user;
    return {
      ...rest,
      plan: this.resolvePlan(user.subscriptions),
      health: this.buildHealthSummary(profile, weightLogs[0]?.weightKg),
      nutritionTarget: nutritionTargets[0] ?? null,
    };
  }

  private buildListWhere(query: QueryAdminUsersDto, now: Date): Prisma.UserWhereInput {
    const search = query.search?.trim();
    const proFilter = activeProSubscriptionWhere(now);

    return {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.plan === UserPlanFilter.PRO ? { subscriptions: { some: proFilter } } : {}),
      ...(query.plan === UserPlanFilter.FREE ? { subscriptions: { none: proFilter } } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private resolvePlan(subs: Array<{ status: string; expiresAt: Date; plan: { price: number } }>) {
    const now = Date.now();
    const isPro = subs.some(
      (s) => s.status === 'ACTIVE' && s.expiresAt.getTime() > now && s.plan.price > 0,
    );
    return isPro ? UserPlanFilter.PRO : UserPlanFilter.FREE;
  }

  /** BMR (Mifflin-St Jeor) and TDEE computed live from the profile — same formulas as the mobile app. */
  private buildHealthSummary(profile: UserProfile | null, latestLoggedWeight?: number) {
    if (!profile) return null;
    const currentWeightKg = latestLoggedWeight ?? profile.weightKg ?? null;
    const age = profile.dateOfBirth ? ageFromDob(profile.dateOfBirth) : null;
    const canCompute = Boolean(currentWeightKg && profile.heightCm && age !== null && profile.gender);

    const bmr = canCompute
      ? calculateBMR(currentWeightKg!, profile.heightCm!, age!, profile.gender!)
      : null;
    const tdee = bmr !== null && profile.activityLevel ? calculateTDEE(bmr, profile.activityLevel) : null;

    return {
      gender: profile.gender,
      age,
      heightCm: profile.heightCm,
      currentWeightKg,
      targetWeightKg: profile.targetWeightKg,
      activityLevel: profile.activityLevel,
      fitnessGoal: profile.fitnessGoal,
      bmr: bmr !== null ? Math.round(bmr) : null,
      tdee: tdee !== null ? Math.round(tdee) : null,
      timezone: profile.timezone,
    };
  }
}

