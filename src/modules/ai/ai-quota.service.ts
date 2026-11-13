import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getVietnamDayRange, VIETNAM_TIMEZONE } from '../../common/utils/date.util';
import type { FoodScanResponse } from './interfaces/food-scan-result.interface';

export interface UserDailyAiQuota {
  isPro: boolean;
  planName: string;
  scans: {
    used: number;
    limit: number;
    remaining: number;
  };
  chats: {
    used: number;
    limit: number;
    remaining: number;
  };
  resetAt: string;
}

@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);

  // Quota configuration constants
  public static readonly FREE_SCAN_LIMIT = 3;
  public static readonly FREE_CHAT_LIMIT = 5;
  public static readonly PRO_SCAN_LIMIT = 20;
  public static readonly PRO_CHAT_LIMIT = 50;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates the UTC time range [startUtc, endUtc] for today based on the user's timezone.
   */
  private getUserTodayRange(userTimezone?: string | null): {
    startUtc: Date;
    endUtc: Date;
    resetAt: Date;
  } {
    const tz = userTimezone?.trim() || VIETNAM_TIMEZONE;

    try {
      const now = new Date();
      // Format current calendar date YYYY-MM-DD in the target timezone
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      const [year, month, day] = dateStr.split('-').map(Number);

      // Start of day in target timezone
      // Using UTC offset approximation or Intl parts
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      }).formatToParts(now);
      const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+7';
      const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
      let offsetMinutes = 7 * 60; // Default UTC+7
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const hours = parseInt(match[2], 10);
        const mins = match[3] ? parseInt(match[3], 10) : 0;
        offsetMinutes = sign * (hours * 60 + mins);
      }

      const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60000);
      const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
      const resetAt = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

      return { startUtc, endUtc, resetAt };
    } catch {
      const { startUtc, endUtc } = getVietnamDayRange();
      const resetAt = new Date(endUtc.getTime() + 1);
      return { startUtc, endUtc, resetAt };
    }
  }

  /**
   * Retrieves user's active plan, subscription state, and today's AI usage.
   */
  async getUserDailyQuota(userId: string): Promise<UserDailyAiQuota> {
    const now = new Date();

    const [userProfile, activeSub] = await Promise.all([
      this.prisma.userProfile.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
      this.prisma.userSubscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          expiresAt: { gt: now },
        },
        include: { plan: true },
        orderBy: { expiresAt: 'desc' },
      }),
    ]);

    const isPro = Boolean(activeSub);
    const planName = activeSub ? activeSub.plan.name : 'Free';

    // Free: 3 scans / 5 chats, Pro: 20 scans / 50 chats
    const scanLimit = isPro ? AiQuotaService.PRO_SCAN_LIMIT : AiQuotaService.FREE_SCAN_LIMIT;
    const chatLimit = isPro ? AiQuotaService.PRO_CHAT_LIMIT : AiQuotaService.FREE_CHAT_LIMIT;

    const { startUtc, endUtc, resetAt } = this.getUserTodayRange(userProfile?.timezone);

    const [scansUsed, chatsUsed] = await Promise.all([
      this.prisma.aiMealAnalysis.count({
        where: {
          userId,
          createdAt: {
            gte: startUtc,
            lte: endUtc,
          },
        },
      }),
      this.prisma.chatMessage.count({
        where: {
          conversation: { userId },
          role: 'USER',
          createdAt: {
            gte: startUtc,
            lte: endUtc,
          },
        },
      }),
    ]);

    return {
      isPro,
      planName,
      scans: {
        used: scansUsed,
        limit: scanLimit,
        remaining: Math.max(0, scanLimit - scansUsed),
      },
      chats: {
        used: chatsUsed,
        limit: chatLimit,
        remaining: Math.max(0, chatLimit - chatsUsed),
      },
      resetAt: resetAt.toISOString(),
    };
  }

  /**
   * Throws 403 Forbidden with structured code and quota if scan quota has been exhausted.
   */
  async assertCanScan(userId: string): Promise<UserDailyAiQuota> {
    const quota = await this.getUserDailyQuota(userId);

    if (quota.scans.remaining <= 0) {
      const message = quota.isPro
        ? `You have reached your daily Pro limit of ${quota.scans.limit} AI food scans. Resets at midnight.`
        : "You've used all your free AI scans today. Upgrade to NutrAI Pro for 20 scans per day.";

      this.logger.warn(`Scan quota exceeded for user=${userId} (${quota.planName}: ${quota.scans.used}/${quota.scans.limit})`);

      throw new ForbiddenException({
        statusCode: 403,
        error: 'QuotaExceeded',
        code: 'DAILY_SCAN_LIMIT_REACHED',
        message,
        quota,
      });
    }

    return quota;
  }

  /**
   * Throws 403 Forbidden with structured code and quota if chat message quota has been exhausted.
   */
  async assertCanChat(userId: string): Promise<UserDailyAiQuota> {
    const quota = await this.getUserDailyQuota(userId);

    if (quota.chats.remaining <= 0) {
      const message = quota.isPro
        ? `You have reached your daily Pro limit of ${quota.chats.limit} AI messages. Resets at midnight.`
        : "You've reached your daily free limit of 5 AI messages. Upgrade to NutrAI Pro for 50 messages per day.";

      this.logger.warn(`Chat quota exceeded for user=${userId} (${quota.planName}: ${quota.chats.used}/${quota.chats.limit})`);

      throw new ForbiddenException({
        statusCode: 403,
        error: 'QuotaExceeded',
        code: 'DAILY_CHAT_LIMIT_REACHED',
        message,
        quota,
      });
    }

    return quota;
  }

  /**
   * Records a successful food scan into `ai_meal_analyses` so it counts toward the daily quota.
   */
  async recordSuccessfulScan(
    userId: string,
    result: FoodScanResponse,
    meta?: { imageUrl?: string; mealId?: string; foodHint?: string },
  ) {
    try {
      const items = result.items || [];
      const analysis = await this.prisma.aiMealAnalysis.create({
        data: {
          userId,
          mealId: meta?.mealId || null,
          inputType: 'IMAGE',
          inputText: meta?.foodHint || null,
          inputImageUrl: meta?.imageUrl || null,
          rawAiResponse: result as any,
          parsedItems: items as any,
          totalCalories: result.estimatedTotalCalories || 0,
          totalProtein: result.totalProtein || 0,
          totalCarbs: result.totalCarbs || 0,
          totalFat: result.totalFat || 0,
          confidence: typeof result.confidence === 'number' ? result.confidence : 0.85,
          status: 'PENDING',
          aiModel: 'gemini-flash-lite-latest',
        },
      });

      this.logger.log(`Saved AI meal analysis record id=${analysis.id} for user=${userId}`);
      return analysis;
    } catch (err: any) {
      this.logger.error(`Failed to record aiMealAnalysis for user=${userId}: ${err.message}`, err.stack);
      return null;
    }
  }
}
