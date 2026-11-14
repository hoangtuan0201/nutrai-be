import { Inject, Injectable, Logger } from '@nestjs/common';
import { MealType, NotificationType, Prisma } from '@prisma/client';
import type { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsRepository } from './notifications.repository';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

export interface SendNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface DeliveryStats {
  successCount: number;
  failureCount: number;
}

/** Provider batch limits: FCM multicast = 500 tokens, Expo push API = 100 messages */
const FCM_MULTICAST_LIMIT = 500;
const EXPO_PUSH_LIMIT = 100;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function addStats(target: DeliveryStats, source: DeliveryStats) {
  target.successCount += source.successCount;
  target.failureCount += source.failureCount;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly prisma: PrismaService,
    @Inject('FIREBASE_ADMIN') private readonly firebaseApp: App,
  ) {}

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    const deviceToken = await this.repo.upsertDeviceToken(userId, dto);
    this.logger.log(
      `Registered device token for user=${userId} (${dto.platform}, model=${dto.deviceModel ?? 'unknown'})`,
    );
    return {
      id: deviceToken.id,
      platform: deviceToken.platform,
      isActive: deviceToken.isActive,
    };
  }

  async removeDeviceToken(userId: string, token: string) {
    await this.repo.deactivateDeviceToken(userId, token);
    return { success: true };
  }

  async getNotifications(userId: string, query: QueryNotificationsDto) {
    return this.repo.findPaginatedByUser(
      userId,
      query.page ?? 1,
      query.limit ?? 20,
      query.unreadOnly ?? false,
    );
  }

  async getUnreadCount(userId: string) {
    return this.repo.getUnreadCount(userId);
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.repo.markAsRead(userId, notificationId);
  }

  async markAllAsRead(userId: string) {
    return this.repo.markAllAsRead(userId);
  }

  /**
   * Core dispatcher:
   * 1. Persists notification in PostgreSQL `notifications` table (for In-App Bell Center)
   * 2. Dispatches push notification to all active device tokens via Firebase Cloud Messaging (FCM)
   *    or Expo Push Service if an ExponentPushToken is registered.
   */
  async sendToUser(payload: SendNotificationPayload) {
    const notification = await this.repo.createNotification({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: (payload.data ?? {}) as Prisma.InputJsonValue,
    });

    const activeDevices = await this.repo.findActiveTokensByUser(payload.userId);
    if (activeDevices.length === 0) {
      return notification;
    }

    const stringData: Record<string, string> = {
      notificationId: notification.id,
      type: payload.type,
      ...(payload.data ?? {}),
    };

    await this.pushToTokens(
      activeDevices.map((d) => d.token),
      payload.title,
      payload.body,
      stringData,
    );

    return notification;
  }

  /**
   * Sends one push message to many device tokens (FCM + Expo), chunked to provider limits.
   * Returns delivery stats so callers (e.g. admin broadcasts) can report the success rate.
   */
  async pushToTokens(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<DeliveryStats> {
    const expoTokens: string[] = [];
    const fcmTokens: string[] = [];

    for (const token of tokens) {
      if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
        expoTokens.push(token);
      } else if (!token.startsWith('fcm_token_') && !token.startsWith('apns_token_')) {
        // Real FCM / APNs token (skip fake seed tokens)
        fcmTokens.push(token);
      }
    }

    const stats: DeliveryStats = { successCount: 0, failureCount: 0 };
    for (const chunk of chunkArray(fcmTokens, FCM_MULTICAST_LIMIT)) {
      addStats(stats, await this.dispatchFcmMulticast(chunk, title, body, data));
    }
    for (const chunk of chunkArray(expoTokens, EXPO_PUSH_LIMIT)) {
      addStats(stats, await this.dispatchExpoPush(chunk, title, body, data));
    }
    return stats;
  }

  private async dispatchFcmMulticast(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<DeliveryStats> {
    try {
      const messaging = getMessaging(this.firebaseApp);
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'nutraai-default',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });

      const invalidTokens: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success && res.error) {
          const code = res.error.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(tokens[idx]);
          } else {
            this.logger.warn(`FCM delivery error for token[${idx}]: ${res.error.message}`);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await this.repo.deactivateInvalidTokens(invalidTokens);
        this.logger.log(`Deactivated ${invalidTokens.length} expired FCM token(s)`);
      }
      return { successCount: response.successCount, failureCount: response.failureCount };
    } catch (err) {
      this.logger.warn(`FCM multicast failed: ${(err as Error).message}`);
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  private async dispatchExpoPush(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<DeliveryStats> {
    try {
      const messages = tokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
        channelId: 'nutraai-default',
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json().catch(() => null)) as { data?: Array<{ status: string }> } | null;
      const tickets = json?.data ?? [];
      const successCount = tickets.filter((t) => t.status === 'ok').length;
      return { successCount, failureCount: tokens.length - successCount };
    } catch (err) {
      this.logger.warn(`Expo push fallback failed: ${(err as Error).message}`);
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  // ==========================================
  // STREAK RESCUE, WEIGH-IN & MEAL CHECK LOGIC
  // ==========================================

  async hasLoggedMealTypeToday(
    userId: string,
    mealType: MealType,
    startUtc: Date,
    endUtc: Date,
  ): Promise<boolean> {
    const count = await this.prisma.meal.count({
      where: {
        userId,
        mealType,
        OR: [
          { loggedDate: { gte: startUtc, lte: endUtc } },
          { loggedAt: { gte: startUtc, lte: endUtc } },
        ],
      },
    });
    return count > 0;
  }

  async hasLoggedAnyMealToday(
    userId: string,
    startUtc: Date,
    endUtc: Date,
  ): Promise<boolean> {
    const count = await this.prisma.meal.count({
      where: {
        userId,
        OR: [
          { loggedDate: { gte: startUtc, lte: endUtc } },
          { loggedAt: { gte: startUtc, lte: endUtc } },
        ],
      },
    });
    return count > 0;
  }

  async hasLoggedWeightToday(
    userId: string,
    startUtc: Date,
    endUtc: Date,
  ): Promise<boolean> {
    const count = await this.prisma.weightLog.count({
      where: {
        userId,
        loggedDate: { gte: startUtc, lte: endUtc },
      },
    });
    return count > 0;
  }

  /**
   * Calculates how many consecutive days ending yesterday (T-1) had at least 1 meal logged.
   */
  async calculateStreakEndingYesterday(
    userId: string,
    todayStartUtc: Date,
    userTz: string,
  ): Promise<number> {
    const sixtyDaysAgoUtc = new Date(todayStartUtc.getTime() - 60 * 24 * 60 * 60 * 1000);
    const pastMeals = await this.prisma.meal.findMany({
      where: {
        userId,
        OR: [
          { loggedDate: { gte: sixtyDaysAgoUtc, lt: todayStartUtc } },
          { loggedAt: { gte: sixtyDaysAgoUtc, lt: todayStartUtc } },
        ],
      },
      select: { loggedDate: true, loggedAt: true },
    });

    const loggedDays = new Set<string>();
    for (const m of pastMeals) {
      const d = m.loggedDate || m.loggedAt;
      const dateStr = this.formatDateInTimezone(d, userTz);
      loggedDays.add(dateStr);
    }

    let streak = 0;
    for (let i = 1; i <= 60; i++) {
      const targetDate = new Date(todayStartUtc.getTime() - i * 24 * 60 * 60 * 1000 + 12 * 3600 * 1000);
      const dateStr = this.formatDateInTimezone(targetDate, userTz);
      if (loggedDays.has(dateStr)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * Evaluates or force-dispatches Streak Rescue Alert.
   * Condition: Streak ending yesterday >= 2 days AND 0 meals logged today.
   */
  async checkAndSendStreakRescue(
    userId: string,
    force = false,
    simulatedStreak = 3,
  ): Promise<{ success: boolean; sent: boolean; streak: number; reason: string }> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const userTz = profile?.timezone || 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const { dateString, startUtc, endUtc } = this.getDayRangeInTimezone(now, userTz);

    const realStreak = await this.calculateStreakEndingYesterday(userId, startUtc, userTz);
    const todayMeals = await this.hasLoggedAnyMealToday(userId, startUtc, endUtc);

    const effectiveStreak = force && realStreak < 2 ? simulatedStreak : realStreak;

    if (!force) {
      if (todayMeals) {
        return {
          success: true,
          sent: false,
          streak: realStreak,
          reason: 'User has already logged at least 1 meal today. Streak is safe.',
        };
      }
      if (realStreak < 2) {
        return {
          success: true,
          sent: false,
          streak: realStreak,
          reason: `User streak ending yesterday is ${realStreak} day(s) (< 2 days threshold). No rescue alert needed.`,
        };
      }
    }

    const tag = `STREAK_RESCUE_${dateString}`;
    if (!force) {
      const alreadySent = await this.repo.hasNotificationToday(
        userId,
        NotificationType.GOAL_ALERT,
        startUtc,
        endUtc,
        tag,
      );
      if (alreadySent) {
        return {
          success: true,
          sent: false,
          streak: effectiveStreak,
          reason: 'Streak rescue alert was already sent today.',
        };
      }
    }

    await this.sendToUser({
      userId,
      type: NotificationType.GOAL_ALERT,
      title: `🔥 Streak Rescue: Don't break your ${effectiveStreak}-day streak!`,
      body: `You've kept your healthy habit for ${effectiveStreak} days in a row. Log a meal before midnight to keep your streak alive!`,
      data: {
        tag,
        route: '/(main)/meals',
        streakDays: String(effectiveStreak),
      },
    });

    return {
      success: true,
      sent: true,
      streak: effectiveStreak,
      reason: `Streak rescue alert sent successfully (${effectiveStreak}-day streak).`,
    };
  }

  /**
   * Evaluates or force-dispatches Weekly Weigh-In notification.
   * Condition: Monday morning (07:30) and no weight logged today.
   */
  async checkAndSendWeeklyWeighIn(
    userId: string,
    force = false,
  ): Promise<{ success: boolean; sent: boolean; reason: string }> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const userTz = profile?.timezone || 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const { dateString, startUtc, endUtc } = this.getDayRangeInTimezone(now, userTz);

    const weightLogged = await this.hasLoggedWeightToday(userId, startUtc, endUtc);

    if (!force) {
      if (weightLogged) {
        return {
          success: true,
          sent: false,
          reason: 'User has already logged weight today.',
        };
      }

      const tag = `WEEKLY_WEIGH_IN_${dateString}`;
      const alreadySent = await this.repo.hasNotificationToday(
        userId,
        NotificationType.SYSTEM,
        startUtc,
        endUtc,
        tag,
      );
      if (alreadySent) {
        return {
          success: true,
          sent: false,
          reason: 'Weekly weigh-in notification already sent today.',
        };
      }
    }

    const tag = `WEEKLY_WEIGH_IN_${dateString}`;
    await this.sendToUser({
      userId,
      type: NotificationType.SYSTEM,
      title: '⚖️ Weekly Weigh-In: Start your week strong!',
      body: 'Step on the scale this Monday morning to keep your Weight Progress graph accurate and on track.',
      data: {
        tag,
        route: '/(main)/progress/weight',
      },
    });

    return {
      success: true,
      sent: true,
      reason: 'Weekly weigh-in notification sent successfully.',
    };
  }

  /**
   * Checks if meal is already logged today. If not logged (or force = true), sends reminder.
   */
  async checkAndSendMealReminder(
    userId: string,
    mealType: MealType,
    force = false,
  ): Promise<{ success: boolean; sent: boolean; reason: string }> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const userTz = profile?.timezone || 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const { dateString, startUtc, endUtc } = this.getDayRangeInTimezone(now, userTz);

    const mealLogged = await this.hasLoggedMealTypeToday(userId, mealType, startUtc, endUtc);

    if (!force && mealLogged) {
      return {
        success: true,
        sent: false,
        reason: `User has already logged ${mealType} today. Reminder suppressed.`,
      };
    }

    const metaMap: Record<MealType, { title: string; body: string; tag: string }> = {
      BREAKFAST: {
        title: 'Good Morning! Time for Breakfast 🍳',
        body: "Start your day strong! Don't forget to log your breakfast in NutrAI.",
        tag: `REMINDER_BREAKFAST_${dateString}`,
      },
      LUNCH: {
        title: 'Time for Lunch! 🥗',
        body: 'Fuel up your afternoon and snap or log your lunch to stay on track.',
        tag: `REMINDER_LUNCH_${dateString}`,
      },
      DINNER: {
        title: 'Evening Dinner Reminder 🍲',
        body: 'Remember to log your dinner to complete your daily nutrition summary.',
        tag: `REMINDER_DINNER_${dateString}`,
      },
      SNACK: {
        title: 'Healthy Snack Reminder 🍎',
        body: 'Grab a nutritious snack and log it to keep your energy high.',
        tag: `REMINDER_SNACK_${dateString}`,
      },
    };

    const meta = metaMap[mealType];
    await this.sendToUser({
      userId,
      type: NotificationType.MEAL_REMINDER,
      title: meta.title,
      body: meta.body,
      data: {
        tag: meta.tag,
        mealType,
        route: '/(main)/meals',
      },
    });

    return {
      success: true,
      sent: true,
      reason: `${mealType} reminder sent successfully.`,
    };
  }

  formatDateInTimezone(date: Date, timeZone: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      return date.toISOString().split('T')[0];
    }
  }

  getDayRangeInTimezone(date: Date, timeZone: string): {
    dateString: string;
    startUtc: Date;
    endUtc: Date;
  } {
    try {
      const str = this.formatDateInTimezone(date, timeZone);
      const [year, month, day] = str.split('-').map(Number);
      return {
        dateString: str,
        startUtc: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
        endUtc: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
      };
    } catch {
      const str = date.toISOString().split('T')[0];
      const [year, month, day] = str.split('-').map(Number);
      return {
        dateString: str,
        startUtc: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
        endUtc: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
      };
    }
  }
}
