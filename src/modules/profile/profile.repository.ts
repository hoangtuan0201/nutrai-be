import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NutritionTargetDto } from './dto/profile-response.dto';
import { getVietnamDayRange } from '../../common/utils/date.util';

/** Raw Prisma shape returned for a UserProfile row */
export type ProfileRow = Awaited<ReturnType<ProfileRepository['findOrCreate']>>;

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensures a UserProfile row always exists; returns it. */
  async findOrCreate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException('User account no longer exists. Please sign in again.');
    }

    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /** Upsert a profile with only the supplied fields, syncing WeightLog if weightKg is updated. */
  async upsert(userId: string, data: Record<string, unknown>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException('User account no longer exists. Please sign in again.');
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    if (typeof data.weightKg === 'number' && data.weightKg > 0) {
      const { loggedDate } = getVietnamDayRange();
      const existingLog = await this.prisma.weightLog.findFirst({
        where: { userId, loggedDate },
      });

      if (existingLog) {
        await this.prisma.weightLog.update({
          where: { id: existingLog.id },
          data: { weightKg: data.weightKg },
        });
      } else {
        await this.prisma.weightLog.create({
          data: {
            userId,
            weightKg: data.weightKg,
            loggedDate,
          },
        });
      }
    }

    return profile;
  }

  /** Fetches the most recent active NutritionTarget, or null. */
  async findActiveTarget(userId: string): Promise<NutritionTargetDto | undefined> {
    const row = await this.prisma.nutritionTarget.findFirst({
      where: { userId, isActive: true },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (!row) return undefined;

    return {
      dailyCalories: row.dailyCalories,
      dailyProtein:  row.dailyProtein,
      dailyCarbs:    row.dailyCarbs,
      dailyFat:      row.dailyFat,
      effectiveFrom: row.effectiveFrom.toISOString().split('T')[0],
    };
  }

  /**
   * Soft-closes previous active targets, then creates or updates today's target.
   * Idempotent — safe to call multiple times on the same day.
   */
  async upsertNutritionTarget(
    userId: string,
    payload: {
      dailyCalories: number;
      dailyProtein: number;
      dailyCarbs: number;
      dailyFat: number;
    },
    _goal: FitnessGoal,
  ): Promise<NutritionTargetDto> {
    const { loggedDate: today } = getVietnamDayRange();

    const existing = await this.prisma.nutritionTarget.findFirst({
      where: { userId, effectiveFrom: today },
      orderBy: { createdAt: 'desc' },
    });

    // Deactivate all other active targets so there is only ever a single active target
    await this.prisma.nutritionTarget.updateMany({
      where: {
        userId,
        isActive: true,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      data: { isActive: false, effectiveTo: today },
    });

    const row = existing
      ? await this.prisma.nutritionTarget.update({
          where: { id: existing.id },
          data: { ...payload, isActive: true, effectiveTo: null },
        })
      : await this.prisma.nutritionTarget.create({
          data: { userId, effectiveFrom: today, ...payload, isActive: true },
        });

    return {
      dailyCalories: row.dailyCalories,
      dailyProtein:  row.dailyProtein,
      dailyCarbs:    row.dailyCarbs,
      dailyFat:      row.dailyFat,
      effectiveFrom: row.effectiveFrom.toISOString().split('T')[0],
    };
  }
}
