import { ConflictException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ActivityLevel,
  BillingPeriod,
  FitnessGoal,
  Gender,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  Role,
} from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminFoodsService } from './foods/admin-foods.service';
import { AdminNotificationsService } from './notifications/admin-notifications.service';
import { BroadcastAudience } from './notifications/dto/admin-notifications.dto';
import { AdminPaymentsService } from './payments/admin-payments.service';
import { AdminUsersService } from './users/admin-users.service';
import { UserPlanFilter } from './users/dto/query-admin-users.dto';

describe('AdminModule (Stage 1)', () => {
  describe('RolesGuard', () => {
    const makeContext = (user: any): ExecutionContext =>
      ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      }) as unknown as ExecutionContext;

    it('allows ADMIN user when @Roles("ADMIN") is set', () => {
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
      const guard = new RolesGuard(reflector);
      expect(guard.canActivate(makeContext({ id: 'u1', role: 'ADMIN' }))).toBe(true);
    });

    it('throws ForbiddenException for USER role on @Roles("ADMIN") route', () => {
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
      const guard = new RolesGuard(reflector);
      expect(() => guard.canActivate(makeContext({ id: 'u2', role: 'USER' }))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('AdminDashboardService', () => {
    it('computes user counts and MRR/ARR (normalizing yearly plan by /12)', async () => {
      const prisma = {
        user: {
          count: jest
            .fn()
            .mockResolvedValueOnce(100) // total
            .mockResolvedValueOnce(5) // newToday
            .mockResolvedValueOnce(20) // newThisWeek
            .mockResolvedValueOnce(50) // newThisMonth
            .mockResolvedValueOnce(12), // proUsers
        },
        userSubscription: {
          groupBy: jest.fn().mockResolvedValue([
            { planId: 'p-month', _count: { _all: 10 } },
            { planId: 'p-year', _count: { _all: 2 } },
          ]),
        },
        subscriptionPlan: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'p-month', price: 49000, billingPeriod: BillingPeriod.MONTHLY },
            { id: 'p-year', price: 399000, billingPeriod: BillingPeriod.YEARLY },
          ]),
        },
        payment: {
          groupBy: jest
            .fn()
            .mockResolvedValueOnce([
              { paymentMethod: PaymentMethod.SEPAY, _sum: { amount: 490000 }, _count: { _all: 10 } },
            ])
            .mockResolvedValueOnce([
              { paymentMethod: PaymentMethod.SEPAY, _sum: { amount: 980000 }, _count: { _all: 20 } },
              { paymentMethod: PaymentMethod.STRIPE, _sum: { amount: 399000 }, _count: { _all: 1 } },
            ]),
        },
      } as any;

      const service = new AdminDashboardService(prisma);
      const res = await service.getOverview();

      expect(res.users).toEqual({
        total: 100,
        newToday: 5,
        newThisWeek: 20,
        newThisMonth: 50,
        proUsers: 12,
        freeUsers: 88,
      });
      // MRR = 10 * 49000 + 2 * (399000 / 12) = 490000 + 66500 = 556500
      expect(res.revenue.mrr).toBe(556500);
      expect(res.revenue.arr).toBe(556500 * 12);
      expect(res.revenue.collectedThisMonth.total).toBe(490000);
      expect(res.revenue.collectedAllTime.total).toBe(1379000);
    });
  });

  describe('AdminUsersService', () => {
    it('maps PRO/FREE status in listUsers and computes BMR/TDEE in getUserDetail', async () => {
      const future = new Date(Date.now() + 86400_000);
      const prisma = {
        user: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'u1',
              email: 'pro@nutrai.com',
              name: 'Pro User',
              avatarUrl: null,
              role: Role.USER,
              authProvider: 'EMAIL',
              isActive: true,
              createdAt: new Date(),
              subscriptions: [{ expiresAt: future, plan: { name: 'Pro Monthly' } }],
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
          findFirst: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'pro@nutrai.com',
            name: 'Pro User',
            avatarUrl: null,
            role: Role.USER,
            authProvider: 'EMAIL',
            isActive: true,
            emailVerified: true,
            createdAt: new Date(),
            profile: {
              dateOfBirth: new Date('2000-01-01'),
              gender: Gender.MALE,
              heightCm: 175,
              weightKg: 70,
              targetWeightKg: 68,
              activityLevel: ActivityLevel.MODERATE,
              fitnessGoal: FitnessGoal.WEIGHT_LOSS,
              timezone: 'Asia/Ho_Chi_Minh',
            },
            nutritionTargets: [{ dailyCalories: 2000, dailyProtein: 130, dailyCarbs: 220, dailyFat: 60 }],
            subscriptions: [{ status: 'ACTIVE', expiresAt: future, plan: { name: 'Pro Monthly', price: 49000, billingPeriod: 'MONTHLY' } }],
            weightLogs: [{ weightKg: 69.5 }],
            _count: { meals: 12, payments: 1 },
          }),
        },
      } as any;

      const service = new AdminUsersService(prisma);
      const list = await service.listUsers({ page: 1, limit: 20, plan: UserPlanFilter.PRO });
      expect(list.items[0].plan).toBe(UserPlanFilter.PRO);
      expect(list.items[0].proPlanName).toBe('Pro Monthly');

      const detail = await service.getUserDetail('u1');
      expect(detail.plan).toBe(UserPlanFilter.PRO);
      expect(detail.health?.currentWeightKg).toBe(69.5);
      expect(detail.health?.bmr).toBeGreaterThan(1500);
      expect(detail.health?.tdee).toBeGreaterThan(detail.health!.bmr!);
    });
  });

  describe('AdminFoodsService', () => {
    it('uploads image when creating food without categoryId', async () => {
      const prisma = {
        food: {
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'f1', ...data })),
        },
      } as any;
      const cloudinary = {
        uploadImage: jest.fn().mockResolvedValue('https://res.cloudinary.com/demo/pho.jpg'),
      } as any;

      const service = new AdminFoodsService(prisma, cloudinary);
      const created = await service.createFood({
        name: 'Phở bò',
        caloriesPer100g: 120,
        proteinPer100g: 8,
        carbsPer100g: 15,
        fatPer100g: 3,
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQ',
      });
      expect(cloudinary.uploadImage).toHaveBeenCalledWith('data:image/jpeg;base64,/9j/4AAQ', 'nutraai/foods');
      expect(created.imageUrl).toBe('https://res.cloudinary.com/demo/pho.jpg');
    });
  });

  describe('AdminPaymentsService', () => {
    it('rejects already COMPLETED payment and manually activates EXPIRED payment', async () => {
      const prisma = {
        payment: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ id: 'pay-done', userId: 'u1', status: PaymentStatus.COMPLETED })
            .mockResolvedValueOnce({
              id: 'pay-exp',
              userId: 'u1',
              planId: 'plan-pro',
              amount: 49000,
              status: PaymentStatus.EXPIRED,
            }),
        },
      } as any;
      const processing = {
        activateManually: jest.fn().mockResolvedValue({ success: true, status: 'COMPLETED' }),
      } as any;

      const service = new AdminPaymentsService(prisma, processing);
      await expect(service.manualActivate('pay-done', 'admin-1', {})).rejects.toThrow(ConflictException);

      const res = await service.manualActivate('pay-exp', 'admin-1', { note: 'Paid late after 15m' });
      expect(processing.activateManually).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'pay-exp',
          userId: 'u1',
          adminId: 'admin-1',
          note: 'Paid late after 15m',
        }),
      );
      expect(res.success).toBe(true);
    });
  });

  describe('AdminNotificationsService', () => {
    it('broadcasts push to target audience tokens and saves notifications with successRate', async () => {
      const prisma = {
        user: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'u1', deviceTokens: [{ token: 'fcm_real_1' }] },
            { id: 'u2', deviceTokens: [{ token: 'fcm_real_2' }] },
          ]),
        },
        notification: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      } as any;
      const notificationsService = {
        pushToTokens: jest.fn().mockResolvedValue({ successCount: 2, failureCount: 0 }),
      } as any;

      const service = new AdminNotificationsService(prisma, notificationsService);
      const res = await service.sendBroadcast('admin-1', {
        title: 'Promo -20%',
        body: 'Upgrade today',
        audience: BroadcastAudience.FREE,
        type: NotificationType.SYSTEM,
      });

      expect(notificationsService.pushToTokens).toHaveBeenCalledWith(
        ['fcm_real_1', 'fcm_real_2'],
        'Promo -20%',
        'Upgrade today',
        expect.objectContaining({ broadcastId: res.broadcastId }),
      );
      expect(prisma.notification.createMany).toHaveBeenCalled();
      expect(res.totalRecipients).toBe(2);
      expect(res.successRate).toBe(100);
    });
  });
});

