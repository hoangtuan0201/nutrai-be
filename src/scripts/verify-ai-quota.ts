import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma/prisma.service';
import { AiQuotaService } from '../modules/ai/ai-quota.service';
import { PaymentsService } from '../modules/payments/payments.service';

async function main() {
  console.log('🚀 Bootstrapping NestJS context for AI Quota Verification...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const quotaService = app.get(AiQuotaService);
  const paymentsService = app.get(PaymentsService);

  try {
    // 1. Find a Free User and a Pro User for testing
    const proUserSub = await prisma.userSubscription.findFirst({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { user: true, plan: true },
    });

    const freeUser = await prisma.user.findFirst({
      where: {
        id: proUserSub ? { not: proUserSub.userId } : undefined,
        isActive: true,
      },
    });

    if (!freeUser) {
      throw new Error('No free user found in database');
    }

    console.log(`👤 Free user: ${freeUser.email} (id=${freeUser.id})`);
    if (proUserSub) {
      console.log(`⭐ Pro user: ${proUserSub.user.email} (id=${proUserSub.userId}, plan=${proUserSub.plan.name})`);
    }

    // 2. Test Quota calculation for Free User
    const freeQuota = await quotaService.getUserDailyQuota(freeUser.id);
    console.log('✅ [1/5] Free User Quota:', {
      isPro: freeQuota.isPro,
      planName: freeQuota.planName,
      scans: freeQuota.scans,
      chats: freeQuota.chats,
      resetAt: freeQuota.resetAt,
    });

    if (freeQuota.scans.limit !== 3 || freeQuota.chats.limit !== 5) {
      throw new Error(`Expected Free limit 3 scans & 5 chats, got ${freeQuota.scans.limit} & ${freeQuota.chats.limit}`);
    }

    // 3. Test Quota calculation for Pro User (if exists)
    if (proUserSub) {
      const proQuota = await quotaService.getUserDailyQuota(proUserSub.userId);
      console.log('✅ [2/5] Pro User Quota:', {
        isPro: proQuota.isPro,
        planName: proQuota.planName,
        scans: proQuota.scans,
        chats: proQuota.chats,
        resetAt: proQuota.resetAt,
      });

      if (proQuota.scans.limit !== 20 || proQuota.chats.limit !== 50) {
        throw new Error(`Expected Pro limit 20 scans & 50 chats, got ${proQuota.scans.limit} & ${proQuota.chats.limit}`);
      }
    }

    // 4. Test Scan assertion and recording
    console.log('🧪 [3/5] Testing Scan assertion & recording...');
    await quotaService.assertCanScan(freeUser.id);
    console.log('  -> assertCanScan passed for free user');

    const fakeScanResult = {
      mealName: 'Test Healthy Chicken Salad',
      mealType: 'LUNCH' as any,
      estimatedTotalCalories: 350,
      totalProtein: 35,
      totalCarbs: 15,
      totalFat: 12,
      confidence: 0.95,
      advice: 'Great protein-rich meal!',
      items: [
        {
          name: 'Grilled Chicken Breast',
          caloriesPer100g: 165,
          estimatedGrams: 150,
          calories: 247,
          protein: 31,
          carbs: 0,
          fat: 5,
        },
      ],
    };

    const recorded = await quotaService.recordSuccessfulScan(freeUser.id, fakeScanResult, {
      foodHint: 'chicken salad test',
    });
    console.log('  -> Recorded fake scan id:', recorded?.id);

    const quotaAfterScan = await quotaService.getUserDailyQuota(freeUser.id);
    console.log('  -> Quota after 1 scan:', quotaAfterScan.scans);

    // Clean up test scan record
    if (recorded?.id) {
      await prisma.aiMealAnalysis.delete({ where: { id: recorded.id } });
      console.log('  -> Cleaned up test scan record');
    }

    // 5. Test Chat assertion
    console.log('🧪 [4/5] Testing Chat assertion...');
    await quotaService.assertCanChat(freeUser.id);
    console.log('  -> assertCanChat passed for free user');

    // 5b. Test 403 Forbidden when scan limit reached
    console.log('🧪 [4b/5] Testing 403 Forbidden on Quota Exhaustion...');
    // Create 3 fake scans for freeUser to hit the limit
    const fakeItems = [{ name: 'Item', calories: 100, caloriesPer100g: 100, estimatedGrams: 100, protein: 5, carbs: 10, fat: 2 }];
    const fakeResult = { mealName: 'Test', mealType: 'SNACK' as any, estimatedTotalCalories: 100, totalProtein: 5, totalCarbs: 10, totalFat: 2, confidence: 0.9, advice: '', items: fakeItems };
    const scan1 = await quotaService.recordSuccessfulScan(freeUser.id, fakeResult);
    const scan2 = await quotaService.recordSuccessfulScan(freeUser.id, fakeResult);
    const scan3 = await quotaService.recordSuccessfulScan(freeUser.id, fakeResult);

    try {
      await quotaService.assertCanScan(freeUser.id);
      throw new Error('assertCanScan should have thrown 403 but succeeded!');
    } catch (err: any) {
      console.log('  -> Caught expected 403:', err.response?.code, '-', err.response?.message);
      if (err.response?.code !== 'DAILY_SCAN_LIMIT_REACHED') {
        throw new Error(`Unexpected error code: ${err.response?.code}`);
      }
    }

    // Clean up the 3 fake scans
    await prisma.aiMealAnalysis.deleteMany({
      where: { id: { in: [scan1!.id, scan2!.id, scan3!.id] } },
    });
    console.log('  -> Cleaned up fake quota test scans');

    // 6. Test PaymentsService.getMySubscription including aiQuota
    console.log('🧪 [5/5] Testing PaymentsService.getMySubscription(freeUser)...');
    const mySub = await paymentsService.getMySubscription(freeUser.id);
    console.log('  -> getMySubscription aiQuota:', mySub.aiQuota);

    console.log('🎉 ALL AI QUOTA VERIFICATION CHECKS PASSED!');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
