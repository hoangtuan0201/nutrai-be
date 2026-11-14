/**
 * NutraAI — Database Seed Script
 *
 * Seeds realistic test data across all 10 domains:
 *   - 3 users (admin, normal user, pro user with active subscription)
 *   - User profiles & nutrition targets
 *   - 44 curated foods with CDN images (USDA-style & Vietnamese dishes)
 *   - Meals with items (past 30 days)
 *   - AI meal analyses & chat conversations
 *   - Daily nutrition summaries
 *   - Weight logs
 *   - Subscription plans & user subscriptions
 *   - Notifications & device tokens
 *   - User settings
 *   - AI usage logs & audit logs
 *
 * Run: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Helpers ──────────────────────────────────────────────
function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Standard password hash using bcrypt so AuthService.login can verify it
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function daysAgo(n: number): Date {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = todayStr.split('-').map(Number);
  // 00:00:00 at Asia/Ho_Chi_Minh (UTC+7)
  return new Date(Date.UTC(year, month - 1, day - n, -7, 0, 0, 0));
}

function dateOnly(d: Date): Date {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

// ── Main Seed ────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding NutraAI database...\n');

  // Clean all tables (order matters for FK constraints)
  console.log('🗑️  Cleaning existing data...');
  await prisma.deviceToken.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userSubscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.weightLog.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.aiMealAnalysis.deleteMany();
  await prisma.mealItem.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.food.deleteMany();
  await prisma.nutritionTarget.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // ═══════════════════════════════════════════════════════
  // DOMAIN 1: USERS
  // ═══════════════════════════════════════════════════════
  console.log('👤 Creating users...');

  const adminId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const proUserId = '33333333-3333-3333-3333-333333333333';

  const passwordHash = await hashPassword('Test@123');

  await prisma.user.createMany({
    data: [
      {
        id: adminId,
        email: 'admin@nutraai.com',
        passwordHash,
        name: 'Admin NutraAI',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
      },
      {
        id: userId,
        email: 'user@nutraai.com',
        passwordHash,
        name: 'Alex Johnson',
        role: 'USER',
        isActive: true,
        emailVerified: true,
      },
      {
        id: proUserId,
        email: 'pro@nutraai.com',
        passwordHash,
        name: 'Sarah Miller',
        role: 'USER',
        isActive: true,
        emailVerified: true,
      },
    ],
  });

  // ═══════════════════════════════════════════════════════
  // DOMAIN 2: USER PROFILES & NUTRITION TARGETS
  // ═══════════════════════════════════════════════════════
  console.log('📋 Creating profiles & nutrition targets...');

  await prisma.userProfile.createMany({
    data: [
      {
        userId: adminId,
        dateOfBirth: new Date('1990-01-15'),
        gender: 'MALE',
        heightCm: 175,
        weightKg: 80,
        activityLevel: 'MODERATE',
        fitnessGoal: 'MAINTENANCE',
      },
      {
        userId,
        dateOfBirth: new Date('1996-05-15'),
        gender: 'MALE',
        heightCm: 175,
        weightKg: 48.7,
        targetWeightKg: 64.6,
        activityLevel: 'MODERATE',
        fitnessGoal: 'MUSCLE_GAIN',
      },
      {
        userId: proUserId,
        dateOfBirth: new Date('1998-03-10'),
        gender: 'FEMALE',
        heightCm: 162,
        weightKg: 55,
        targetWeightKg: 52,
        activityLevel: 'VERY_ACTIVE',
        fitnessGoal: 'MUSCLE_GAIN',
      },
    ],
  });

  const userTargetId = uuid();
  const proTargetId = uuid();

  await prisma.nutritionTarget.createMany({
    data: [
      {
        id: uuid(),
        userId: adminId,
        dailyCalories: 2500,
        dailyProtein: 125,
        dailyCarbs: 300,
        dailyFat: 80,
        effectiveFrom: daysAgo(30),
        isActive: true,
      },
      {
        id: userTargetId,
        userId,
        dailyCalories: 2200,
        dailyProtein: 135,
        dailyCarbs: 260,
        dailyFat: 68,
        effectiveFrom: daysAgo(30),
        isActive: true,
      },
      {
        id: proTargetId,
        userId: proUserId,
        dailyCalories: 2200,
        dailyProtein: 140,
        dailyCarbs: 250,
        dailyFat: 65,
        effectiveFrom: daysAgo(30),
        isActive: true,
      },
    ],
  });

  // ═══════════════════════════════════════════════════════
  // DOMAIN 3: FOODS (44 verified foods with images)
  // ═══════════════════════════════════════════════════════
  console.log('🥦 Creating verified foods with images...');

  const foodRows = [
    // Baseline foods referenced by sample meal templates
    {
      id: uuid(),
      name: 'Chicken Breast',
      description: 'Boiled skinless chicken breast',
      caloriesPer100g: 165,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      servingUnit: 'g',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'White Rice',
      description: 'Cooked white jasmine rice',
      caloriesPer100g: 130,
      proteinPer100g: 2.7,
      carbsPer100g: 28,
      fatPer100g: 0.3,
      servingUnit: 'g',
      defaultServingSize: 200,
      imageUrl: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Greek Yogurt',
      description: 'Plain unsweetened Greek yogurt',
      caloriesPer100g: 59,
      proteinPer100g: 10,
      carbsPer100g: 3.6,
      fatPer100g: 0.7,
      servingUnit: 'g',
      defaultServingSize: 170,
      imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Tofu',
      description: 'Fresh soft white tofu',
      caloriesPer100g: 76,
      proteinPer100g: 8,
      carbsPer100g: 1.9,
      fatPer100g: 4.8,
      servingUnit: 'g',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Beef Pho',
      description: 'Traditional beef noodle soup (1 bowl)',
      caloriesPer100g: 95,
      proteinPer100g: 6,
      carbsPer100g: 12,
      fatPer100g: 2.5,
      servingUnit: 'bowl',
      defaultServingSize: 400,
      imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Vietnamese Pork Sandwich (Banh Mi)',
      description: 'Baguette with savory pork and pickled vegetables',
      caloriesPer100g: 250,
      proteinPer100g: 9,
      carbsPer100g: 33,
      fatPer100g: 9,
      servingUnit: 'serving',
      defaultServingSize: 200,
      imageUrl: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    // Protein
    {
      id: uuid(),
      name: 'Grilled Chicken Breast',
      description: 'Skinless chicken breast fillet, grilled without oil',
      caloriesPer100g: 165,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      servingUnit: 'fillet',
      defaultServingSize: 100,
      imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Grilled Salmon',
      description: 'Fresh Atlantic salmon fillet, rich in Omega-3',
      caloriesPer100g: 208,
      proteinPer100g: 20.4,
      carbsPer100g: 0,
      fatPer100g: 13.4,
      servingUnit: 'fillet',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Hard-boiled Egg',
      description: 'Whole boiled chicken egg (~60g)',
      caloriesPer100g: 155,
      proteinPer100g: 13,
      carbsPer100g: 1.1,
      fatPer100g: 11,
      servingUnit: 'piece',
      defaultServingSize: 60,
      imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Beef Steak (Sirloin)',
      description: 'Lean grilled beef sirloin steak',
      caloriesPer100g: 244,
      proteinPer100g: 27,
      carbsPer100g: 0,
      fatPer100g: 14.2,
      servingUnit: 'fillet',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Steamed Tofu',
      description: 'Fresh white soybean curd tofu',
      caloriesPer100g: 76,
      proteinPer100g: 8.1,
      carbsPer100g: 1.9,
      fatPer100g: 4.8,
      servingUnit: 'block',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Steamed Shrimp',
      description: 'Peeled steamed tiger prawns / shrimp',
      caloriesPer100g: 99,
      proteinPer100g: 24,
      carbsPer100g: 0.2,
      fatPer100g: 0.3,
      servingUnit: 'serving',
      defaultServingSize: 100,
      imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Canned Tuna in Water',
      description: 'Light chunk tuna drained in brine/water',
      caloriesPer100g: 116,
      proteinPer100g: 26,
      carbsPer100g: 0,
      fatPer100g: 1,
      servingUnit: 'can',
      defaultServingSize: 120,
      imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    // Carbohydrates
    {
      id: uuid(),
      name: 'Steamed Rice',
      description: 'Cooked white jasmine rice',
      caloriesPer100g: 130,
      proteinPer100g: 2.7,
      carbsPer100g: 28,
      fatPer100g: 0.3,
      servingUnit: 'cup',
      defaultServingSize: 100,
      imageUrl: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Brown Rice',
      description: 'Cooked whole grain brown rice, high in fiber',
      caloriesPer100g: 112,
      proteinPer100g: 2.6,
      carbsPer100g: 23.5,
      fatPer100g: 0.9,
      servingUnit: 'cup',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Rolled Oats (Cooked)',
      description: 'Oatmeal cooked with water',
      caloriesPer100g: 71,
      proteinPer100g: 2.5,
      carbsPer100g: 12,
      fatPer100g: 1.5,
      servingUnit: 'bowl',
      defaultServingSize: 200,
      imageUrl: 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    {
      id: uuid(),
      name: 'Whole Wheat Bread',
      description: '100% whole grain whole wheat sandwich bread',
      caloriesPer100g: 247,
      proteinPer100g: 13,
      carbsPer100g: 41.3,
      fatPer100g: 3.4,
      servingUnit: 'slice',
      defaultServingSize: 40,
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Cooked Spaghetti Pasta',
      description: 'Boiled durum wheat semolina pasta',
      caloriesPer100g: 158,
      proteinPer100g: 5.8,
      carbsPer100g: 30.9,
      fatPer100g: 0.9,
      servingUnit: 'serving',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    // Vegetables
    {
      id: uuid(),
      name: 'Broccoli',
      description: 'Fresh steamed green broccoli florets',
      caloriesPer100g: 35,
      proteinPer100g: 2.4,
      carbsPer100g: 7.2,
      fatPer100g: 0.4,
      servingUnit: 'serving',
      defaultServingSize: 100,
      imageUrl: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Baby Spinach',
      description: 'Raw tender baby spinach leaves',
      caloriesPer100g: 23,
      proteinPer100g: 2.9,
      carbsPer100g: 3.6,
      fatPer100g: 0.4,
      servingUnit: 'cup',
      defaultServingSize: 50,
      imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Mixed Garden Salad',
      description: 'Lettuce, cucumber, and cherry tomatoes without dressing',
      caloriesPer100g: 18,
      proteinPer100g: 1.2,
      carbsPer100g: 3.4,
      fatPer100g: 0.2,
      servingUnit: 'bowl',
      defaultServingSize: 150,
      imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Cucumber',
      description: 'Fresh sliced raw cucumber with peel',
      caloriesPer100g: 15,
      proteinPer100g: 0.7,
      carbsPer100g: 3.6,
      fatPer100g: 0.1,
      servingUnit: 'piece',
      defaultServingSize: 100,
      imageUrl: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    // Fruits
    {
      id: uuid(),
      name: 'Red Apple',
      description: 'Crisp fresh red Gala/Fuji apple',
      caloriesPer100g: 52,
      proteinPer100g: 0.3,
      carbsPer100g: 13.8,
      fatPer100g: 0.2,
      servingUnit: 'medium apple',
      defaultServingSize: 182,
      imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Banana',
      description: 'Fresh ripe Cavendish banana',
      caloriesPer100g: 89,
      proteinPer100g: 1.1,
      carbsPer100g: 22.8,
      fatPer100g: 0.3,
      servingUnit: 'piece',
      defaultServingSize: 120,
      imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Avocado',
      description: 'Fresh Hass avocado, rich in healthy monounsaturated fat',
      caloriesPer100g: 160,
      proteinPer100g: 2,
      carbsPer100g: 8.5,
      fatPer100g: 14.7,
      servingUnit: 'half',
      defaultServingSize: 75,
      imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Blueberries',
      description: 'Fresh antioxidant-rich wild blueberries',
      caloriesPer100g: 57,
      proteinPer100g: 0.7,
      carbsPer100g: 14.5,
      fatPer100g: 0.3,
      servingUnit: 'cup',
      defaultServingSize: 100,
      imageUrl: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Orange',
      description: 'Juicy navel orange, high in Vitamin C',
      caloriesPer100g: 47,
      proteinPer100g: 0.9,
      carbsPer100g: 11.8,
      fatPer100g: 0.1,
      servingUnit: 'medium orange',
      defaultServingSize: 130,
      imageUrl: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    // Dairy & Alternatives
    {
      id: uuid(),
      name: 'Greek Yogurt (Plain)',
      description: 'Authentic strained plain Greek yogurt, 0% fat',
      caloriesPer100g: 59,
      proteinPer100g: 10,
      carbsPer100g: 3.6,
      fatPer100g: 0.4,
      servingUnit: 'cup',
      defaultServingSize: 170,
      imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Fresh Whole Milk',
      description: 'Pasteurized whole cows milk (3.5% fat)',
      caloriesPer100g: 62,
      proteinPer100g: 3.3,
      carbsPer100g: 4.8,
      fatPer100g: 3.5,
      servingUnit: 'glass',
      defaultServingSize: 200,
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },


    // Vietnamese Dishes
    {
      id: uuid(),
      name: 'Phở Bò Tái Nạm',
      description: 'Traditional Vietnamese beef pho with rare beef flank, broth, and fresh herbs',
      caloriesPer100g: 88,
      proteinPer100g: 5.6,
      carbsPer100g: 12.5,
      fatPer100g: 2.1,
      servingUnit: 'bowl',
      defaultServingSize: 500,
      imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Cơm Tấm Sườn Nướng',
      description: 'Vietnamese broken rice with marinated grilled pork chop and scallion oil',
      caloriesPer100g: 165,
      proteinPer100g: 8.5,
      carbsPer100g: 22,
      fatPer100g: 5.1,
      servingUnit: 'plate',
      defaultServingSize: 350,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Bánh Mì Thịt Nguội',
      description: 'Crispy baguette with pork ham, pate, cucumber, and pickled daikon',
      caloriesPer100g: 235,
      proteinPer100g: 9.2,
      carbsPer100g: 31,
      fatPer100g: 8.4,
      servingUnit: 'sandwich',
      defaultServingSize: 180,
      imageUrl: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Gỏi Cuốn Tôm Thịt',
      description: 'Fresh spring rolls with shrimp, pork, vermicelli, and peanut dipping sauce',
      caloriesPer100g: 110,
      proteinPer100g: 6.8,
      carbsPer100g: 16.5,
      fatPer100g: 2.2,
      servingUnit: 'roll',
      defaultServingSize: 60,
      imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Bún Chả Hà Nội',
      description: 'Hanoi style grilled pork meatballs with rice vermicelli and dipping sauce',
      caloriesPer100g: 135,
      proteinPer100g: 7.2,
      carbsPer100g: 18,
      fatPer100g: 4.1,
      servingUnit: 'set',
      defaultServingSize: 400,
      imageUrl: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    // Snacks & Bakery
    {
      id: uuid(),
      name: 'Chocolate Chip Cookie',
      description: 'Baked golden cookie with dark chocolate chips',
      caloriesPer100g: 488,
      proteinPer100g: 5.5,
      carbsPer100g: 64,
      fatPer100g: 24,
      servingUnit: 'cookie',
      defaultServingSize: 30,
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Almonds (Roasted)',
      description: 'Whole dry roasted unsalted almonds',
      caloriesPer100g: 579,
      proteinPer100g: 21.2,
      carbsPer100g: 21.6,
      fatPer100g: 49.9,
      servingUnit: 'serving',
      defaultServingSize: 28,
      imageUrl: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Chocolate Muffin',
      description: 'Rich baked cocoa muffin with chocolate drizzle',
      caloriesPer100g: 375,
      proteinPer100g: 5.2,
      carbsPer100g: 51,
      fatPer100g: 17,
      servingUnit: 'muffin',
      defaultServingSize: 115,
      imageUrl: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Peanut Butter',
      description: '100% natural smooth roasted peanut butter',
      caloriesPer100g: 588,
      proteinPer100g: 25,
      carbsPer100g: 20,
      fatPer100g: 50,
      servingUnit: 'tbsp',
      defaultServingSize: 32,
      imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },

    // Beverages
    {
      id: uuid(),
      name: 'Americano / Black Coffee',
      description: 'Freshly brewed espresso diluted with hot water, zero sugar',
      caloriesPer100g: 2,
      proteinPer100g: 0.1,
      carbsPer100g: 0.3,
      fatPer100g: 0,
      servingUnit: 'cup',
      defaultServingSize: 240,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Vietnamese Iced Milk Coffee (Cà Phê Sữa Đá)',
      description: 'Drip filtered coffee with sweetened condensed milk and ice',
      caloriesPer100g: 78,
      proteinPer100g: 1.8,
      carbsPer100g: 12.5,
      fatPer100g: 2.4,
      servingUnit: 'glass',
      defaultServingSize: 250,
      imageUrl: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Green Tea (Unsweetened)',
      description: 'Brewed green tea leaves, zero calorie antioxidant drink',
      caloriesPer100g: 1,
      proteinPer100g: 0,
      carbsPer100g: 0.2,
      fatPer100g: 0,
      servingUnit: 'cup',
      defaultServingSize: 200,
      imageUrl: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    {
      id: uuid(),
      name: 'Fresh Orange Juice',
      description: '100% freshly squeezed orange juice, no added sugar',
      caloriesPer100g: 45,
      proteinPer100g: 0.7,
      carbsPer100g: 10.4,
      fatPer100g: 0.2,
      servingUnit: 'glass',
      defaultServingSize: 250,
      imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
      isVerified: true,
    },
  ];

  await prisma.food.createMany({ data: foodRows });

  const foodIdByName = new Map(foodRows.map((f) => [f.name, f.id]));
  const foodChicken = foodIdByName.get('Chicken Breast')!;
  const foodRice = foodIdByName.get('White Rice')!;
  const foodEgg = foodIdByName.get('Hard-boiled Egg')!;
  const foodSalmon = foodIdByName.get('Grilled Salmon')!;
  const foodBroccoli = foodIdByName.get('Broccoli')!;
  const foodBanana = foodIdByName.get('Banana')!;
  const foodYogurt = foodIdByName.get('Greek Yogurt')!;
  const foodTofu = foodIdByName.get('Tofu')!;
  const foodBanhMi = foodIdByName.get('Vietnamese Pork Sandwich (Banh Mi)')!;

  // ═══════════════════════════════════════════════════════
  // DOMAIN 3b: MEALS (past 7 days for userId)
  // ═══════════════════════════════════════════════════════
  console.log('🍱 Creating meals for past 7 days...');

  const mealTemplates = [
    {
      mealType: 'BREAKFAST' as const,
      name: 'Breakfast',
      items: [
        { foodId: foodEgg, foodName: 'Hard-boiled Egg', quantity: 2, unit: 'piece', calories: 186, protein: 15.6, carbs: 1.3, fat: 13.2 },
        { foodId: foodBanhMi, foodName: 'Vietnamese Pork Sandwich (Banh Mi)', quantity: 0.5, unit: 'serving', calories: 250, protein: 9, carbs: 33, fat: 9 },
        { foodId: foodBanana, foodName: 'Banana', quantity: 1, unit: 'piece', calories: 107, protein: 1.3, carbs: 27.6, fat: 0.4 },
      ],
    },
    {
      mealType: 'LUNCH' as const,
      name: 'Lunch',
      items: [
        { foodId: foodChicken, foodName: 'Chicken Breast', quantity: 1, unit: 'serving', calories: 248, protein: 46.5, carbs: 0, fat: 5.4 },
        { foodId: foodRice, foodName: 'White Rice', quantity: 1, unit: 'serving', calories: 260, protein: 5.4, carbs: 56, fat: 0.6 },
        { foodId: foodBroccoli, foodName: 'Broccoli', quantity: 1, unit: 'serving', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
      ],
    },
    {
      mealType: 'DINNER' as const,
      name: 'Dinner',
      items: [
        { foodId: foodSalmon, foodName: 'Grilled Salmon', quantity: 1, unit: 'serving', calories: 312, protein: 30, carbs: 0, fat: 19.5 },
        { foodId: foodRice, foodName: 'White Rice', quantity: 0.5, unit: 'serving', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
        { foodId: foodTofu, foodName: 'Tofu', quantity: 1, unit: 'serving', calories: 114, protein: 12, carbs: 2.9, fat: 7.2 },
      ],
    },
    {
      mealType: 'SNACK' as const,
      name: 'Snack',
      items: [
        { foodId: foodYogurt, foodName: 'Greek Yogurt', quantity: 1, unit: 'serving', calories: 100, protein: 17, carbs: 6.1, fat: 1.2 },
      ],
    },
  ];

  const createdMealIds: string[] = [];

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const day = daysAgo(dayOffset);
    const mealsForDay = dayOffset === 0
      ? mealTemplates.slice(0, 2) // Today: only breakfast & lunch so far
      : mealTemplates; // Past days: all 4 meals

    for (const template of mealsForDay) {
      const mealId = uuid();
      createdMealIds.push(mealId);

      const totalCal = template.items.reduce((s, i) => s + i.calories, 0);
      const totalPro = template.items.reduce((s, i) => s + i.protein, 0);
      const totalCarb = template.items.reduce((s, i) => s + i.carbs, 0);
      const totalFat = template.items.reduce((s, i) => s + i.fat, 0);

      // Add slight daily variance
      const variance = randomBetween(0.9, 1.1);

      await prisma.meal.create({
        data: {
          id: mealId,
          userId,
          mealType: template.mealType,
          name: template.name,
          totalCalories: Math.round(totalCal * variance),
          totalProtein: Math.round(totalPro * variance * 10) / 10,
          totalCarbs: Math.round(totalCarb * variance * 10) / 10,
          totalFat: Math.round(totalFat * variance * 10) / 10,
          source: 'MANUAL',
          loggedDate: dateOnly(day),
          loggedAt: new Date(day.getTime() + (template.mealType === 'BREAKFAST' ? 7 : template.mealType === 'LUNCH' ? 12 : template.mealType === 'DINNER' ? 19 : 15) * 3600000),
          items: {
            create: template.items.map((item, idx) => ({
              foodId: item.foodId,
              foodName: item.foodName,
              quantity: item.quantity,
              unit: item.unit,
              calories: Math.round(item.calories * variance),
              protein: Math.round(item.protein * variance * 10) / 10,
              carbs: Math.round(item.carbs * variance * 10) / 10,
              fat: Math.round(item.fat * variance * 10) / 10,
              sortOrder: idx,
            })),
          },
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // DOMAIN 4: AI MEAL ANALYSIS & CHAT
  // ═══════════════════════════════════════════════════════
  console.log('🤖 Creating AI analyses & chat conversations...');

  // One AI analysis for yesterday's lunch (linked)
  const aiAnalysisId = uuid();
  await prisma.aiMealAnalysis.create({
    data: {
      id: aiAnalysisId,
      userId,
      mealId: createdMealIds[3], // yesterday's lunch
      inputType: 'TEXT',
      inputText: '1 bowl of rice + 150g chicken breast + steamed broccoli',
      rawAiResponse: {
        model: 'gemini-2.0-flash',
        items: [
          { name: 'White Rice', calories: 260, protein: 5.4, carbs: 56, fat: 0.6 },
          { name: 'Chicken Breast', calories: 248, protein: 46.5, carbs: 0, fat: 5.4 },
          { name: 'Broccoli', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
        ],
      },
      parsedItems: [
        { name: 'White Rice', portion: '200g', calories: 260, protein: 5.4, carbs: 56, fat: 0.6 },
        { name: 'Chicken Breast', portion: '150g', calories: 248, protein: 46.5, carbs: 0, fat: 5.4 },
        { name: 'Broccoli', portion: '100g', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
      ],
      totalCalories: 543,
      totalProtein: 54.3,
      totalCarbs: 63.2,
      totalFat: 6.4,
      confidence: 0.92,
      status: 'CONFIRMED',
      aiModel: 'gemini-2.0-flash',
      tokensUsed: 256,
      latencyMs: 1200,
    },
  });

  // One pending AI analysis (not yet linked to a meal)
  await prisma.aiMealAnalysis.create({
    data: {
      userId: proUserId,
      inputType: 'IMAGE',
      inputImageUrl: 'https://example.com/meal-photo-1.jpg',
      rawAiResponse: { model: 'gemini-2.0-flash', status: 'pending_review' },
      parsedItems: [
        { name: 'Beef Pho', portion: '1 bowl', calories: 380, protein: 24, carbs: 48, fat: 10 },
      ],
      totalCalories: 380,
      totalProtein: 24,
      totalCarbs: 48,
      totalFat: 10,
      confidence: 0.78,
      status: 'PENDING',
      aiModel: 'gemini-2.0-flash',
      tokensUsed: 512,
      latencyMs: 2100,
    },
  });

  // Chat conversation
  const convoId = uuid();
  await prisma.chatConversation.create({
    data: {
      id: convoId,
      userId,
      title: 'Muscle Gain Nutrition Advice',
      isActive: true,
      lastMessageAt: daysAgo(0),
      messages: {
        create: [
          {
            role: 'USER',
            content: 'I want to build muscle and gain healthy weight. How should I plan my diet?',
            tokensUsed: 20,
            createdAt: daysAgo(2),
          },
          {
            role: 'ASSISTANT',
            content: 'To build lean muscle effectively, aim for a caloric surplus of around 300-500 kcal/day relative to your TDEE. With your target of 2200 kcal/day, eating sufficient protein (130-140g) is key.\n\n🍽️ Meal Suggestions:\n- Breakfast: 500-550 kcal (eggs + oatmeal + peanut butter)\n- Lunch: 600-650 kcal (rice + chicken breast + broccoli)\n- Dinner: 550-600 kcal (salmon + sweet potato + greens)\n- Snack: 200-250 kcal (Greek yogurt + banana + almonds)',
            tokensUsed: 180,
            latencyMs: 1500,
            createdAt: new Date(daysAgo(2).getTime() + 2000),
          },
          {
            role: 'USER',
            content: 'Thanks! Do I need to take whey protein powder?',
            tokensUsed: 15,
            createdAt: daysAgo(1),
          },
          {
            role: 'ASSISTANT',
            content: "Not necessarily! As long as you hit your daily protein goal of 135g through whole foods (chicken, fish, eggs, tofu), supplements aren't required. However, if you are short on time, 1 scoop of whey (~120 kcal, 24g protein) post-workout is very convenient. 💪",
            tokensUsed: 120,
            latencyMs: 1100,
            createdAt: new Date(daysAgo(1).getTime() + 2000),
          },
        ],
      },
    },
  });

  // ═══════════════════════════════════════════════════════
  // DOMAIN 5: PROGRESS — Weight Logs
  // ═══════════════════════════════════════════════════════
  console.log('📊 Creating weight logs...');

  const weightLogSamples = [
    { daysAgo: 14, weightKg: 43.5, note: 'Starting muscle building journey 💪' },
    { daysAgo: 11, weightKg: 44.2, note: 'Appetite improving, good gym sessions' },
    { daysAgo: 8, weightKg: 45.0, note: 'Post leg-day weigh-in' },
    { daysAgo: 6, weightKg: 45.8, note: 'Morning fasting check' },
    { daysAgo: 4, weightKg: 46.5, note: 'Hitting daily 2200 kcal surplus' },
    { daysAgo: 2, weightKg: 47.4, note: 'Feeling much stronger in gym' },
    { daysAgo: 1, weightKg: 48.1, note: 'Pre-workout weight' },
    { daysAgo: 0, weightKg: 48.7, note: '+5.2kg gained vs Oct 14! Milestone reached 🚀' },
  ];

  for (const log of weightLogSamples) {
    await prisma.weightLog.create({
      data: {
        userId,
        weightKg: log.weightKg,
        loggedDate: dateOnly(daysAgo(log.daysAgo)),
        note: log.note,
      },
    });
  }

  // ═══════════════════════════════════════════════════════
  // DOMAIN 6: SUBSCRIPTION PLANS & USER SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════
  console.log('💳 Creating subscription plans & payments...');

  const freePlanId = uuid();
  const proMonthlyId = uuid();
  const proYearlyId = uuid();

  await prisma.subscriptionPlan.createMany({
    data: [
      {
        id: freePlanId,
        name: 'Free',
        description: 'Basic nutrition tracking with limited AI features',
        price: 0,
        currency: 'VND',
        billingPeriod: 'MONTHLY',
        features: {
          maxMealsPerDay: 5,
          aiAnalysisPerDay: 3,
          aiChatPerDay: 5,
          exportReports: false,
          advancedInsights: false,
        },
        sortOrder: 1,
      },
      {
        id: proMonthlyId,
        name: 'Pro Monthly',
        description: 'Unlimited AI features, advanced insights, export reports',
        price: 49000,
        currency: 'VND',
        billingPeriod: 'MONTHLY',
        features: {
          maxMealsPerDay: -1,
          aiAnalysisPerDay: 20,
          aiChatPerDay: 50,
          exportReports: true,
          advancedInsights: true,
          prioritySupport: true,
        },
        sortOrder: 2,
      },
      {
        id: proYearlyId,
        name: 'Pro Yearly',
        description: 'All Pro features, billed yearly (save 30%)',
        price: 399000,
        currency: 'VND',
        billingPeriod: 'YEARLY',
        features: {
          maxMealsPerDay: -1,
          aiAnalysisPerDay: 20,
          aiChatPerDay: 50,
          exportReports: true,
          advancedInsights: true,
          prioritySupport: true,
        },
        sortOrder: 3,
      },
    ],
  });

  // proUser has an active Pro subscription
  const subId = uuid();
  await prisma.userSubscription.create({
    data: {
      id: subId,
      userId: proUserId,
      planId: proMonthlyId,
      status: 'ACTIVE',
      transactionId: `GP-${uuid().slice(0, 8)}`,
      startsAt: daysAgo(15),
      expiresAt: new Date(new Date().setDate(new Date().getDate() + 15)),
    },
  });

  // Create payment record for Pro subscription
  await prisma.payment.create({
    data: {
      userId: proUserId,
      subscriptionId: subId,
      amount: 99000,
      currency: 'VND',
      paymentMethod: 'GOOGLE_PLAY',
      status: 'COMPLETED',
      transactionId: `GP-TXN-${uuid().slice(0, 8)}`,
      paidAt: daysAgo(15),
    },
  });

  // ═══════════════════════════════════════════════════════
  // DOMAIN 7: NOTIFICATIONS
  // ═══════════════════════════════════════════════════════
  console.log('🔔 Creating notifications...');

  await prisma.notification.createMany({
    data: [
      {
        userId,
        type: 'MEAL_REMINDER',
        title: 'Time for Lunch! 🍜',
        body: "Don't forget to log your lunch today to keep your calories on track.",
        isRead: false,
        createdAt: daysAgo(0),
      },
      {
        userId,
        type: 'GOAL_ALERT',
        title: 'Almost at your goal! 🎯',
        body: 'You have logged 1,520 / 1,800 kcal today. Just 280 kcal left!',
        isRead: true,
        readAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
      {
        userId,
        type: 'AI_RECOMMENDATION',
        title: 'AI Insight 🤖',
        body: 'Your protein intake this week is averaging 15g below your target. Try adding eggs or chicken breast to your breakfast!',
        isRead: false,
        createdAt: daysAgo(2),
      },
      {
        userId: proUserId,
        type: 'SUBSCRIPTION',
        title: 'Welcome to Pro! ⭐',
        body: 'You have upgraded to Pro Monthly. Enjoy unlimited AI features and analytics!',
        isRead: true,
        readAt: daysAgo(15),
        createdAt: daysAgo(15),
      },
    ],
  });

  await prisma.deviceToken.createMany({
    data: [
      {
        userId,
        token: `fcm_token_${uuid().slice(0, 16)}`,
        platform: 'ANDROID',
        deviceModel: 'Samsung Galaxy S24',
        isActive: true,
        lastUsedAt: daysAgo(0),
      },
      {
        userId: proUserId,
        token: `apns_token_${uuid().slice(0, 16)}`,
        platform: 'IOS',
        deviceModel: 'iPhone 16 Pro',
        isActive: true,
        lastUsedAt: daysAgo(0),
      },
    ],
  });

  // ── Summary ──────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    refreshTokens: await prisma.refreshToken.count(),
    deviceTokens: await prisma.deviceToken.count(),
    profiles: await prisma.userProfile.count(),
    nutritionTargets: await prisma.nutritionTarget.count(),
    foods: await prisma.food.count(),
    meals: await prisma.meal.count(),
    mealItems: await prisma.mealItem.count(),
    aiAnalyses: await prisma.aiMealAnalysis.count(),
    chatConversations: await prisma.chatConversation.count(),
    chatMessages: await prisma.chatMessage.count(),
    weightLogs: await prisma.weightLog.count(),
    subscriptionPlans: await prisma.subscriptionPlan.count(),
    userSubscriptions: await prisma.userSubscription.count(),
    payments: await prisma.payment.count(),
    notifications: await prisma.notification.count(),
  };

  console.log('\n✅ Seed completed!\n');
  console.log('📊 Record counts:');
  Object.entries(counts).forEach(([table, count]) => {
    console.log(`   ${table.padEnd(22)} ${count}`);
  });

  console.log('\n🔐 Test accounts (password: Test@123):');
  console.log('   admin@nutraai.com    — ADMIN');
  console.log('   user@nutraai.com     — USER (with meals, progress, chat)');
  console.log('   pro@nutraai.com      — USER + Pro subscription');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
