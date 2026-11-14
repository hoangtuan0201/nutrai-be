import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Platform, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { toPaginated } from '../common/pagination';
import { activeProSubscriptionWhere } from '../common/subscription.filters';
import {
  BroadcastAudience,
  BroadcastNotificationDto,
  QueryBroadcastHistoryDto,
} from './dto/admin-notifications.dto';

export interface BroadcastHistoryRow {
  broadcastId: string;
  title: string;
  body: string;
  type: NotificationType;
  audience: BroadcastAudience;
  totalRecipients: number;
  activeTokensTargeted: number;
  pushSuccessCount: number;
  pushFailureCount: number;
  successRate: number;
  sentByAdminId: string | null;
  createdAt: Date;
}

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDeviceTokenStats() {
    const [totalActiveTokens, androidTokens, iosTokens, usersWithPushRows] = await Promise.all([
      this.prisma.deviceToken.count({ where: { isActive: true } }),
      this.prisma.deviceToken.count({ where: { isActive: true, platform: Platform.ANDROID } }),
      this.prisma.deviceToken.count({ where: { isActive: true, platform: Platform.IOS } }),
      this.prisma.deviceToken.groupBy({
        by: ['userId'],
        where: { isActive: true },
      }),
    ]);

    return {
      totalActiveTokens,
      androidTokens,
      iosTokens,
      usersWithActivePush: usersWithPushRows.length,
    };
  }

  /**
   * Sends a broadcast notification:
   * 1. Resolves target users by audience (ALL | FREE | INACTIVE_3D)
   * 2. Persists in-app notifications in `notifications` table with a shared broadcastId
   * 3. Dispatches push notifications via FCM / Expo to active `device_tokens`
   * 4. Records delivery statistics (successRate, pushSuccessCount, pushFailureCount)
   */
  async sendBroadcast(adminId: string, dto: BroadcastNotificationDto) {
    const now = new Date();
    const userWhere = this.buildAudienceWhere(dto.audience, now);

    const targetUsers = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        deviceTokens: {
          where: { isActive: true },
          select: { token: true },
        },
      },
    });

    const broadcastId = randomUUID();
    const tokens = targetUsers.flatMap((u) => u.deviceTokens.map((d) => d.token));
    const uniqueTokens = Array.from(new Set(tokens));

    const delivery =
      uniqueTokens.length > 0
        ? await this.notificationsService.pushToTokens(uniqueTokens, dto.title, dto.body, {
            broadcastId,
            type: dto.type ?? NotificationType.SYSTEM,
            ...(dto.route ? { route: dto.route } : {}),
          })
        : { successCount: 0, failureCount: 0 };

    const totalPushAttempted = delivery.successCount + delivery.failureCount;
    const successRate =
      totalPushAttempted > 0
        ? Math.round((delivery.successCount / totalPushAttempted) * 1000) / 10
        : 0;

    const metadata = {
      isAdminBroadcast: true,
      broadcastId,
      audience: dto.audience,
      totalRecipients: targetUsers.length,
      activeTokensTargeted: uniqueTokens.length,
      pushSuccessCount: delivery.successCount,
      pushFailureCount: delivery.failureCount,
      successRate,
      sentByAdminId: adminId,
      ...(dto.route ? { route: dto.route } : {}),
    } satisfies Prisma.JsonObject;

    if (targetUsers.length > 0) {
      await this.prisma.notification.createMany({
        data: targetUsers.map((u) => ({
          userId: u.id,
          type: dto.type ?? NotificationType.SYSTEM,
          title: dto.title,
          body: dto.body,
          data: metadata,
          createdAt: now,
        })),
      });
    }

    this.logger.log(
      `Admin ${adminId} broadcast [${dto.audience}] id=${broadcastId}: recipients=${targetUsers.length}, tokens=${uniqueTokens.length}, pushOk=${delivery.successCount}/${totalPushAttempted}`,
    );

    return {
      broadcastId,
      audience: dto.audience,
      title: dto.title,
      body: dto.body,
      totalRecipients: targetUsers.length,
      activeTokensTargeted: uniqueTokens.length,
      pushSuccessCount: delivery.successCount,
      pushFailureCount: delivery.failureCount,
      successRate,
      sentAt: now.toISOString(),
    };
  }

  /**
   * Lists distinct admin broadcast campaigns stored in `notifications.data`
   * along with their delivery success rate and current active device token summary.
   */
  async listBroadcastHistory(query: QueryBroadcastHistoryDto) {
    const search = query.search?.trim();
    const offset = (query.page - 1) * query.limit;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`n.data->>'isAdminBroadcast' = 'true'`,
    ];

    if (query.audience) {
      conditions.push(Prisma.sql`n.data->>'audience' = ${query.audience}`);
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(Prisma.sql`(n.title ILIKE ${pattern} OR n.body ILIKE ${pattern})`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const [rows, countRows, tokenStats] = await Promise.all([
      this.prisma.$queryRaw<BroadcastHistoryRow[]>`
        SELECT * FROM (
          SELECT DISTINCT ON (n.data->>'broadcastId')
            n.data->>'broadcastId' AS "broadcastId",
            n.title AS "title",
            n.body AS "body",
            n.type AS "type",
            n.data->>'audience' AS "audience",
            COALESCE((n.data->>'totalRecipients')::int, 0) AS "totalRecipients",
            COALESCE((n.data->>'activeTokensTargeted')::int, 0) AS "activeTokensTargeted",
            COALESCE((n.data->>'pushSuccessCount')::int, 0) AS "pushSuccessCount",
            COALESCE((n.data->>'pushFailureCount')::int, 0) AS "pushFailureCount",
            COALESCE((n.data->>'successRate')::float, 0) AS "successRate",
            n.data->>'sentByAdminId' AS "sentByAdminId",
            n."createdAt" AS "createdAt"
          FROM notifications n
          WHERE ${whereClause}
          ORDER BY n.data->>'broadcastId', n."createdAt" DESC
        ) sub
        ORDER BY sub."createdAt" DESC
        LIMIT ${query.limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(DISTINCT n.data->>'broadcastId') AS "total"
        FROM notifications n
        WHERE ${whereClause}
      `,
      this.getDeviceTokenStats(),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      ...toPaginated(rows, total, query.page, query.limit),
      tokenStats,
    };
  }

  private buildAudienceWhere(audience: BroadcastAudience, now: Date): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
      role: Role.USER,
    };

    if (audience === BroadcastAudience.FREE) {
      return {
        ...base,
        subscriptions: { none: activeProSubscriptionWhere(now) },
      };
    }

    if (audience === BroadcastAudience.INACTIVE_3D) {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      return {
        ...base,
        meals: { none: { loggedAt: { gte: threeDaysAgo } } },
        deviceTokens: { none: { isActive: true, lastUsedAt: { gte: threeDaysAgo } } },
      };
    }

    return base;
  }
}
