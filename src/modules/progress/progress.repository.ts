import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LogWeightDto } from './dto/log-weight.dto';
import { getVietnamDayRange } from '../../common/utils/date.util';

@Injectable()
export class ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserProfileAndTarget(userId: string) {
    const [profile, target] = await Promise.all([
      this.prisma.userProfile.findUnique({
        where: { userId },
      }),
      this.prisma.nutritionTarget.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { profile, target };
  }

  async getWeightLogs(userId: string, limit = 30) {
    return this.prisma.weightLog.findMany({
      where: { userId },
      orderBy: { loggedDate: 'desc' },
      take: limit,
    });
  }

  async createOrUpdateWeightLog(userId: string, dto: LogWeightDto) {
    const { loggedDate } = getVietnamDayRange(dto.loggedDate);

    const existing = await this.prisma.weightLog.findFirst({
      where: {
        userId,
        loggedDate,
      },
    });

    let result;
    if (existing) {
      result = await this.prisma.weightLog.update({
        where: { id: existing.id },
        data: {
          weightKg: dto.weightKg,
          note: dto.note !== undefined ? dto.note : existing.note,
        },
      });
    } else {
      result = await this.prisma.weightLog.create({
        data: {
          userId,
          weightKg: dto.weightKg,
          note: dto.note,
          loggedDate,
        },
      });
    }

    // Always keep UserProfile.weightKg synced with the latest chronological weight log
    const latest = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedDate: 'desc' },
    });
    if (latest) {
      await this.prisma.userProfile.updateMany({
        where: { userId },
        data: { weightKg: latest.weightKg },
      });
    }

    return result;
  }

  async getMealsInRange(userId: string, startDate: Date, endDate: Date) {
    return this.prisma.meal.findMany({
      where: {
        userId,
        loggedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
      orderBy: { loggedDate: 'asc' },
    });
  }

  async upsertNutritionTarget(
    userId: string,
    payload: {
      dailyCalories: number;
      dailyProtein: number;
      dailyCarbs: number;
      dailyFat: number;
    },
    goal: any,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Deactivate older active targets
    await this.prisma.nutritionTarget.updateMany({
      where: { userId, isActive: true, effectiveFrom: { lt: today } },
      data: { isActive: false, effectiveTo: today },
    });

    const existing = await this.prisma.nutritionTarget.findFirst({
      where: { userId, effectiveFrom: today },
    });

    return existing
      ? this.prisma.nutritionTarget.update({
          where: { id: existing.id },
          data: { ...payload, isActive: true },
        })
      : this.prisma.nutritionTarget.create({
          data: { userId, effectiveFrom: today, ...payload, isActive: true },
        });
  }
}
