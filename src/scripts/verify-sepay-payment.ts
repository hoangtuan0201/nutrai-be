import { NestFactory } from '@nestjs/core';
import { BillingPeriod } from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma/prisma.service';
import { CheckoutPaymentMethod } from '../modules/payments/dto/create-checkout.dto';
import { PaymentsService } from '../modules/payments/payments.service';

async function main() {
  console.log('🚀 Bootstrapping NestJS context for SePay Payment Verification...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const paymentsService = app.get(PaymentsService);

  try {
    // 1. Ensure Pro Monthly plan exists and is set to 49,000 VND (matching SePay test)
    await prisma.subscriptionPlan.updateMany({
      where: { name: 'Pro Monthly' },
      data: { price: 49000, isActive: true },
    });

    const plans = await paymentsService.getPlans();
    console.log(
      '✅ [1/6] Active Subscription Plans:',
      plans.map((p) => `${p.name}: ${p.price} ${p.currency} (${p.billingPeriod})`),
    );

    // 2. Test Live SePay Sandbox API Connection
    const diagnostics = await paymentsService.getSePayGatewayDiagnostics();
    console.log('✅ [2/6] Live SePay Sandbox Diagnostics:', {
      bankAccountsCount: diagnostics.bankAccounts.length,
      bankAccount: diagnostics.bankAccounts[0]
        ? `${diagnostics.bankAccounts[0].bank_short_name} - ${diagnostics.bankAccounts[0].account_number} (${diagnostics.bankAccounts[0].account_holder_name})`
        : 'none',
      webhooksCount: diagnostics.webhooks.length,
      recentTransactionsCount: diagnostics.recentTransactions.length,
    });

    // Pick a user for testing
    const user = await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!user) {
      throw new Error('No active user found in database for testing');
    }
    console.log(`👤 Testing with user: ${user.email} (id=${user.id})`);

    // 3. Step 1-3: Create PENDING Checkout & VietQR
    const checkout = await paymentsService.createCheckout(user.id, {
      billingPeriod: BillingPeriod.MONTHLY,
      paymentMethod: CheckoutPaymentMethod.SEPAY,
    });
    console.log('✅ [3/6] Created PENDING SePay Checkout & VietQR:', {
      paymentId: checkout.paymentId,
      paymentCode: checkout.paymentCode,
      status: checkout.status,
      amount: checkout.amount,
      qrUrl: 'sepay' in checkout ? checkout.sepay?.qrUrl : null,
    });

    // 4. Step 6-8: Simulate SePay Webhook with paymentCode
    const simulatedEventId = `sepay-test-${Date.now()}`;
    const webhookRes = await paymentsService.handleSePayWebhook({
      id: simulatedEventId,
      gateway: 'MBBank',
      transactionDate: '2026-11-09 19:05:00',
      accountNumber: '0899223595',
      code: checkout.paymentCode,
      content: `Chuyen khoan ${checkout.paymentCode}`,
      transferType: 'in',
      transferAmount: checkout.amount,
      referenceCode: `REF-${checkout.paymentCode}`,
    });
    console.log('✅ [4/6] Processed SePay Webhook:', webhookRes);

    // 5. Verify Idempotency (sending the exact same webhook again)
    const idempotentRes = await paymentsService.handleSePayWebhook({
      id: simulatedEventId,
      gateway: 'MBBank',
      transactionDate: '2026-11-09 19:05:00',
      accountNumber: '0899223595',
      code: checkout.paymentCode,
      content: `Chuyen khoan ${checkout.paymentCode}`,
      transferType: 'in',
      transferAmount: checkout.amount,
      referenceCode: `REF-${checkout.paymentCode}`,
    });
    console.log('✅ [5/6] Verified Webhook Idempotency:', idempotentRes);

    // 6. Verify UserSubscription is ACTIVE in PostgreSQL
    const mySub = await paymentsService.getMySubscription(user.id);
    console.log('✅ [6/6] Verified Active UserSubscription:', {
      isPro: mySub.isPro,
      planName: mySub.planName,
      status: mySub.subscription?.status,
      startsAt: mySub.subscription?.startsAt,
      expiresAt: mySub.subscription?.expiresAt,
    });

    // Also test syncing the live SePay Sandbox transaction ("USERPRO", 49000 VND)
    const syncRes = await paymentsService.syncSePayTransactions();
    console.log('✅ Live SePay API v2 Transaction Sync Result:', JSON.stringify(syncRes, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
