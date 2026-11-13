import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MealType, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getVietnamDayRange } from '../../common/utils/date.util';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

interface MealReminderMeta {
  mealType: MealType;
  tag: string;
  title: string;
  body: string;
}

const MEAL_REMINDER_META: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', MealReminderMeta> = {
  BREAKFAST: {
    mealType: MealType.BREAKFAST,
    tag: 'REMINDER_BREAKFAST',
    title: 'Good Morning! Time for Breakfast 🍳',
    body: "Start your day strong! Don't forget to log your breakfast in NutrAI.",
  },
  LUNCH: {
    mealType: MealType.LUNCH,
    tag: 'REMINDER_LUNCH',
    title: 'Time for Lunch! 🥗',
    body: 'Fuel up your afternoon and snap or log your lunch to stay on track.',
  },
  DINNER: {
    mealType: MealType.DINNER,
    tag: 'REMINDER_DINNER',
    title: 'Evening Dinner Reminder 🍲',
    body: 'Remember to log your dinner to complete your daily nutrition summary.',
  },
};

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsRepo: NotificationsRepository,
  ) {}

  /**
   * Runs every minute and checks which users have a meal reminder scheduled
   * for the current minute based on EACH USER'S DEVICE TIMEZONE.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleMealRemindersCron() {
    try {
      const activeProfiles = await this.prisma.userProfile.findMany({
        where: {
          notificationMealReminder: true,
          user: { isActive: true, deletedAt: null },
        },
        select: {
          userId: true,
          timezone: true,
          reminderBreakfastMinutes: true,
          reminderLunchMinutes: true,
          reminderDinnerMinutes: true,
        },
      });

      if (activeProfiles.length === 0) return;

      const now = new Date();

      for (const profile of activeProfiles) {
        const userTz = profile.timezone || 'Asia/Ho_Chi_Minh';
        const currentMinutes = this.getMinutesInTimezone(now, userTz);

        const dueSlots: ('BREAKFAST' | 'LUNCH' | 'DINNER')[] = [];
        if (profile.reminderBreakfastMinutes === currentMinutes) dueSlots.push('BREAKFAST');
        if (profile.reminderLunchMinutes === currentMinutes) dueSlots.push('LUNCH');
        if (profile.reminderDinnerMinutes === currentMinutes) dueSlots.push('DINNER');

        if (dueSlots.length === 0) continue;

        const { startUtc, endUtc } = this.getDayRangeInTimezone(now, userTz);

        for (const slot of dueSlots) {
          const meta = MEAL_REMINDER_META[slot];
          const timeSpecificTag = `${meta.tag}_${currentMinutes}`;

          // Skip if this meal type has ALREADY been logged today
          const alreadyLogged = await this.notificationsService.hasLoggedMealTypeToday(
            profile.userId,
            meta.mealType,
            startUtc,
            endUtc,
          );
          if (alreadyLogged) {
            this.logger.debug(
              `Skip ${slot} reminder for user=${profile.userId}: already logged today.`,
            );
            continue;
          }

          // Skip only if this exact time-slot reminder was already dispatched today
          const alreadyReminded = await this.notificationsRepo.hasNotificationToday(
            profile.userId,
            NotificationType.MEAL_REMINDER,
            startUtc,
            endUtc,
            timeSpecificTag,
          );
          if (alreadyReminded) continue;

          await this.notificationsService.sendToUser({
            userId: profile.userId,
            type: NotificationType.MEAL_REMINDER,
            title: meta.title,
            body: meta.body,
            data: {
              tag: timeSpecificTag,
              mealType: meta.mealType,
              route: '/(main)/meals',
            },
          });

          this.logger.log(
            `Sent ${slot} reminder (minutes=${currentMinutes}, tz=${userTz}) to user=${profile.userId}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Meal reminder cron error: ${(err as Error).message}`);
    }
  }

  /**
   * Streak Rescue Alert (21:00 nightly in user's device timezone).
   * If user has streak >= 2 ending yesterday, but hasn't logged any meals today,
   * alert them to log before midnight to protect their streak.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleStreakRescueCron() {
    try {
      const activeProfiles = await this.prisma.userProfile.findMany({
        where: {
          user: { isActive: true, deletedAt: null },
        },
        select: {
          userId: true,
          timezone: true,
        },
      });

      if (activeProfiles.length === 0) return;

      const now = new Date();

      for (const profile of activeProfiles) {
        const userTz = profile.timezone || 'Asia/Ho_Chi_Minh';
        const currentMinutes = this.getMinutesInTimezone(now, userTz);

        // 21:00 is 1260 minutes
        if (currentMinutes === 1260) {
          const res = await this.notificationsService.checkAndSendStreakRescue(
            profile.userId,
            false,
          );
          if (res.sent) {
            this.logger.log(
              `Dispatched Streak Rescue Alert to user=${profile.userId} (streak=${res.streak})`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(`Streak rescue cron error: ${(err as Error).message}`);
    }
  }

  /**
   * Weekly Weigh-In Reminder (Every Monday at 07:30 in user's device timezone).
   * Reminds user to step on the scale to keep their Weight Progress graph up to date.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleWeeklyWeighInCron() {
    try {
      const activeProfiles = await this.prisma.userProfile.findMany({
        where: {
          user: { isActive: true, deletedAt: null },
        },
        select: {
          userId: true,
          timezone: true,
        },
      });

      if (activeProfiles.length === 0) return;

      const now = new Date();

      for (const profile of activeProfiles) {
        const userTz = profile.timezone || 'Asia/Ho_Chi_Minh';
        const currentMinutes = this.getMinutesInTimezone(now, userTz);
        const dayOfWeek = this.getDayOfWeekInTimezone(now, userTz);

        // Monday (1) at 07:30 (450 minutes)
        if (dayOfWeek === 1 && currentMinutes === 450) {
          const res = await this.notificationsService.checkAndSendWeeklyWeighIn(
            profile.userId,
            false,
          );
          if (res.sent) {
            this.logger.log(
              `Dispatched Weekly Weigh-In reminder to user=${profile.userId}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(`Weekly weigh-in cron error: ${(err as Error).message}`);
    }
  }

  private getDayOfWeekInTimezone(date: Date, timeZone: string): number {
    try {
      const weekdayStr = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
      }).format(date);
      const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      return dayMap[weekdayStr] ?? 1;
    } catch {
      return date.getUTCDay();
    }
  }

  private getMinutesInTimezone(date: Date, timeZone: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(date);

      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
      const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
      return hour * 60 + minute;
    } catch {
      return (date.getUTCHours() * 60 + date.getUTCMinutes() + 420) % 1440;
    }
  }

  private getDayRangeInTimezone(date: Date, timeZone: string): { startUtc: Date; endUtc: Date } {
    try {
      const str = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      const [year, month, day] = str.split('-').map(Number);
      return {
        startUtc: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
        endUtc: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
      };
    } catch {
      return getVietnamDayRange();
    }
  }
}
