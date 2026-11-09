import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Platform, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    const now = new Date();
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: dto.platform as Platform,
        deviceModel: dto.deviceModel ?? null,
        isActive: true,
        lastUsedAt: now,
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform as Platform,
        deviceModel: dto.deviceModel ?? null,
        isActive: true,
        lastUsedAt: now,
      },
    });
  }

  async deactivateDeviceToken(userId: string, token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }

  async deactivateInvalidTokens(tokens: string[]) {
    if (tokens.length === 0) return;
    await this.prisma.deviceToken.updateMany({
      where: { token: { in: tokens } },
      data: { isActive: false },
    });
  }

  async findActiveTokensByUser(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { token: true, platform: true },
    });
  }

  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? Prisma.DbNull,
        isRead: false,
      },
    });
  }

  async findPaginatedByUser(
    userId: string,
    page: number,
    limit: number,
    unreadOnly = false,
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.isRead) {
      return existing;
    }
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  async hasNotificationToday(
    userId: string,
    type: NotificationType,
    startUtc: Date,
    endUtc: Date,
    tagKey?: string,
  ): Promise<boolean> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        type,
        createdAt: { gte: startUtc, lte: endUtc },
      },
      select: { data: true },
    });
    if (notifications.length === 0) return false;
    if (!tagKey) return true;

    return notifications.some((n) => {
      if (n.data && typeof n.data === 'object' && !Array.isArray(n.data)) {
        return (n.data as Record<string, unknown>).tag === tagKey;
      }
      return false;
    });
  }
}

