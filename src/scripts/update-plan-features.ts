import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function updatePlans() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:8640633z@localhost:5432/nutraai_db?schema=public',
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  await prisma.subscriptionPlan.updateMany({
    where: { name: 'Free' },
    data: {
      price: 0,
      features: {
        maxMealsPerDay: 5,
        aiAnalysisPerDay: 3,
        aiChatPerDay: 5,
        exportReports: false,
        advancedInsights: false,
      },
    },
  });

  await prisma.subscriptionPlan.updateMany({
    where: { name: 'Pro Monthly' },
    data: {
      price: 49000,
      features: {
        maxMealsPerDay: -1,
        aiAnalysisPerDay: 20,
        aiChatPerDay: 50,
        exportReports: true,
        advancedInsights: true,
        prioritySupport: true,
      },
    },
  });

  await prisma.subscriptionPlan.updateMany({
    where: { name: 'Pro Yearly' },
    data: {
      price: 399000,
      features: {
        maxMealsPerDay: -1,
        aiAnalysisPerDay: 20,
        aiChatPerDay: 50,
        exportReports: true,
        advancedInsights: true,
        prioritySupport: true,
      },
    },
  });

  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log(
    'UPDATED PLANS:',
    plans.map((p) => ({
      name: p.name,
      price: p.price,
      billingPeriod: p.billingPeriod,
      features: p.features,
    })),
  );

  await prisma.$disconnect();
  await pool.end();
}

updatePlans().catch(console.error);

