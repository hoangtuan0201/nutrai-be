import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const PREFERENCE_SELECT = {
  notificationMealReminder: true,
  timezone: true,
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

