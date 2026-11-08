import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const PREFERENCE_SELECT = {
  notificationMealReminder: true,
  notificationGoalAlert: true,
  notificationAiRecommendation: true,
  reminderBreakfastMinutes: true,
  reminderLunchMinutes: true,
  reminderDinnerMinutes: true,
} as const;

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });
  }

  getPreferences(userId: string) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: PREFERENCE_SELECT,
    });
  }

  updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
      select: PREFERENCE_SELECT,
    });
  }

  async exportAll(userId: string) {
    const [user, profile, targets, meals, weightLogs] = await Promise.all([
      this.findUser(userId),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.nutritionTarget.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.meal.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedDate: 'desc' } }),
    ]);
    return { user, profile, nutritionTargets: targets, meals, weightLogs };
  }

  /** Soft delete: deactivate account and revoke all sessions. */
  async softDelete(userId: string) {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } }),
      this.prisma.deviceToken.updateMany({ where: { userId }, data: { isActive: false } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, deletedAt: new Date() },
      }),
    ]);
  }
}

