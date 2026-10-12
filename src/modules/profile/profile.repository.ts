import { Injectable } from '@nestjs/common';
import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NutritionTargetDto } from './dto/profile-response.dto';

/** Raw Prisma shape returned for a UserProfile row */
export type ProfileRow = Awaited<ReturnType<ProfileRepository['findOrCreate']>>;

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensures a UserProfile row always exists; returns it. */
  findOrCreate(userId: string) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /** Upsert a profile with only the supplied fields. */
  upsert(userId: string, data: Record<string, unknown>) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  /** Fetches the most recent active NutritionTarget, or null. */
  async findActiveTarget(userId: string): Promise<NutritionTargetDto | undefined> {
    const row = await this.prisma.nutritionTarget.findFirst({
      where: { userId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
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
    goal: FitnessGoal,
  ): Promise<NutritionTargetDto> {
    const today = this.startOfToday();

    // Deactivate targets older than today
    await this.prisma.nutritionTarget.updateMany({
      where: { userId, isActive: true, effectiveFrom: { lt: today } },
      data: { isActive: false, effectiveTo: today },
    });

    const existing = await this.prisma.nutritionTarget.findFirst({
      where: { userId, effectiveFrom: today },
    });

    const row = existing
      ? await this.prisma.nutritionTarget.update({
          where: { id: existing.id },
          data: { ...payload, isActive: true },
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

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
