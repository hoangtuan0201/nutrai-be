/**
 * NutraAI — Seed Foods Script
 * Populates / updates verified foods with high-quality CDN images and accurate nutritional data.
 * Can be run safely at any time using: npm run seed:foods
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const host = process.env.POSTGRES_HOST;
const port = process.env.POSTGRES_PORT;
const db = process.env.POSTGRES_DB;

let connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes('${')) {
  connectionString = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function uuid(): string {
  return crypto.randomUUID();
}

interface SeedFoodItem {
  name: string;
  categoryName: string;
  description: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingUnit: string;
  defaultServingSize: number;
  imageUrl: string;
}

const CATEGORIES = [
  { name: 'Protein', description: 'Poultry, meat, fish, eggs, and tofu', sortOrder: 1 },
  { name: 'Carbohydrates', description: 'Rice, noodles, bread, potatoes, and whole grains', sortOrder: 2 },
  { name: 'Vegetables', description: 'Fresh greens, vegetables, and salads', sortOrder: 3 },
  { name: 'Fruits', description: 'Fresh fruits and berries', sortOrder: 4 },
  { name: 'Dairy & Alternatives', description: 'Milk, cheese, yogurt, and plant milks', sortOrder: 5 },
  { name: 'Vietnamese Dishes', description: 'Popular traditional Vietnamese meals', sortOrder: 6 },
  { name: 'Snacks & Bakery', description: 'Cookies, nuts, muffins, and healthy snacks', sortOrder: 7 },
  { name: 'Beverages', description: 'Coffee, tea, and healthy drinks', sortOrder: 8 },
];

const FOODS: SeedFoodItem[] = [
  // ── 1. PROTEIN ───────────────────────────────────────────
  {
    name: 'Grilled Chicken Breast',
    categoryName: 'Protein',
    description: 'Skinless chicken breast fillet, grilled without oil',
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    servingUnit: 'fillet',
    defaultServingSize: 100,
    imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Grilled Salmon',
    categoryName: 'Protein',
    description: 'Fresh Atlantic salmon fillet, rich in Omega-3',
    caloriesPer100g: 208,
    proteinPer100g: 20.4,
    carbsPer100g: 0,
    fatPer100g: 13.4,
    servingUnit: 'fillet',
    defaultServingSize: 150,
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Hard-boiled Egg',
    categoryName: 'Protein',
    description: 'Whole boiled chicken egg (~60g)',
    caloriesPer100g: 155,
    proteinPer100g: 13,
    carbsPer100g: 1.1,
    fatPer100g: 11,
    servingUnit: 'piece',
    defaultServingSize: 60,
    imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Beef Steak (Sirloin)',
    categoryName: 'Protein',
    description: 'Lean grilled beef sirloin steak',
    caloriesPer100g: 244,
    proteinPer100g: 27,
    carbsPer100g: 0,
    fatPer100g: 14.2,
    servingUnit: 'fillet',
    defaultServingSize: 150,
    imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Steamed Tofu',
    categoryName: 'Protein',
    description: 'Fresh white soybean curd tofu',
    caloriesPer100g: 76,
    proteinPer100g: 8.1,
    carbsPer100g: 1.9,
    fatPer100g: 4.8,
    servingUnit: 'block',
    defaultServingSize: 150,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Steamed Shrimp',
    categoryName: 'Protein',
    description: 'Peeled steamed tiger prawns / shrimp',
    caloriesPer100g: 99,
    proteinPer100g: 24,
    carbsPer100g: 0.2,
    fatPer100g: 0.3,
    servingUnit: 'serving',
    defaultServingSize: 100,
    imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Canned Tuna in Water',
    categoryName: 'Protein',
    description: 'Light chunk tuna drained in brine/water',
    caloriesPer100g: 116,
    proteinPer100g: 26,
    carbsPer100g: 0,
    fatPer100g: 1,
    servingUnit: 'can',
    defaultServingSize: 120,
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80',
  },

  // ── 2. CARBOHYDRATES ─────────────────────────────────────
  {
    name: 'Steamed Rice',
    categoryName: 'Carbohydrates',
    description: 'Cooked white jasmine rice',
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28,
    fatPer100g: 0.3,
    servingUnit: 'cup',
    defaultServingSize: 100,
    imageUrl: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Brown Rice',
    categoryName: 'Carbohydrates',
    description: 'Cooked whole grain brown rice, high in fiber',
    caloriesPer100g: 112,
    proteinPer100g: 2.6,
    carbsPer100g: 23.5,
    fatPer100g: 0.9,
    servingUnit: 'cup',
    defaultServingSize: 150,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Rolled Oats (Cooked)',
    categoryName: 'Carbohydrates',
    description: 'Oatmeal cooked with water',
    caloriesPer100g: 71,
    proteinPer100g: 2.5,
    carbsPer100g: 12,
    fatPer100g: 1.5,
    servingUnit: 'bowl',
    defaultServingSize: 200,
    imageUrl: 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Steamed Sweet Potato',
    categoryName: 'Carbohydrates',
    description: 'Baked or steamed whole yellow sweet potato',
    caloriesPer100g: 86,
    proteinPer100g: 1.6,
    carbsPer100g: 20.1,
    fatPer100g: 0.1,
    servingUnit: 'piece',
    defaultServingSize: 150,
    imageUrl: 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Whole Wheat Bread',
    categoryName: 'Carbohydrates',
    description: '100% whole grain whole wheat sandwich bread',
    caloriesPer100g: 247,
    proteinPer100g: 13,
    carbsPer100g: 41.3,
    fatPer100g: 3.4,
    servingUnit: 'slice',
    defaultServingSize: 40,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Cooked Spaghetti Pasta',
    categoryName: 'Carbohydrates',
    description: 'Boiled durum wheat semolina pasta',
    caloriesPer100g: 158,
    proteinPer100g: 5.8,
    carbsPer100g: 30.9,
    fatPer100g: 0.9,
    servingUnit: 'serving',
    defaultServingSize: 150,
    imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&auto=format&fit=crop&q=80',
  },

  // ── 3. VEGETABLES ────────────────────────────────────────
  {
    name: 'Broccoli',
    categoryName: 'Vegetables',
    description: 'Fresh steamed green broccoli florets',
    caloriesPer100g: 35,
    proteinPer100g: 2.4,
    carbsPer100g: 7.2,
    fatPer100g: 0.4,
    servingUnit: 'serving',
    defaultServingSize: 100,
    imageUrl: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Baby Spinach',
    categoryName: 'Vegetables',
    description: 'Raw tender baby spinach leaves',
    caloriesPer100g: 23,
    proteinPer100g: 2.9,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
    servingUnit: 'cup',
    defaultServingSize: 50,
    imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Mixed Garden Salad',
    categoryName: 'Vegetables',
    description: 'Lettuce, cucumber, and cherry tomatoes without dressing',
    caloriesPer100g: 18,
    proteinPer100g: 1.2,
    carbsPer100g: 3.4,
    fatPer100g: 0.2,
    servingUnit: 'bowl',
    defaultServingSize: 150,
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Cucumber',
    categoryName: 'Vegetables',
    description: 'Fresh sliced raw cucumber with peel',
    caloriesPer100g: 15,
    proteinPer100g: 0.7,
    carbsPer100g: 3.6,
    fatPer100g: 0.1,
    servingUnit: 'piece',
    defaultServingSize: 100,
    imageUrl: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=500&auto=format&fit=crop&q=80',
  },

  // ── 4. FRUITS ────────────────────────────────────────────
  {
    name: 'Red Apple',
    categoryName: 'Fruits',
    description: 'Crisp fresh red Gala/Fuji apple',
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 13.8,
    fatPer100g: 0.2,
    servingUnit: 'medium apple',
    defaultServingSize: 182,
    imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Banana',
    categoryName: 'Fruits',
    description: 'Fresh ripe Cavendish banana',
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.8,
    fatPer100g: 0.3,
    servingUnit: 'piece',
    defaultServingSize: 120,
    imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Avocado',
    categoryName: 'Fruits',
    description: 'Fresh Hass avocado, rich in healthy monounsaturated fat',
    caloriesPer100g: 160,
    proteinPer100g: 2,
    carbsPer100g: 8.5,
    fatPer100g: 14.7,
    servingUnit: 'half',
    defaultServingSize: 75,
    imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Blueberries',
    categoryName: 'Fruits',
    description: 'Fresh antioxidant-rich wild blueberries',
    caloriesPer100g: 57,
    proteinPer100g: 0.7,
    carbsPer100g: 14.5,
    fatPer100g: 0.3,
    servingUnit: 'cup',
    defaultServingSize: 100,
    imageUrl: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Orange',
    categoryName: 'Fruits',
    description: 'Juicy navel orange, high in Vitamin C',
    caloriesPer100g: 47,
    proteinPer100g: 0.9,
    carbsPer100g: 11.8,
    fatPer100g: 0.1,
    servingUnit: 'medium orange',
    defaultServingSize: 130,
    imageUrl: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=500&auto=format&fit=crop&q=80',
  },

  // ── 5. DAIRY & ALTERNATIVES ──────────────────────────────
  {
    name: 'Greek Yogurt (Plain)',
    categoryName: 'Dairy & Alternatives',
    description: 'Authentic strained plain Greek yogurt, 0% fat',
    caloriesPer100g: 59,
    proteinPer100g: 10,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
    servingUnit: 'cup',
    defaultServingSize: 170,
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Fresh Whole Milk',
    categoryName: 'Dairy & Alternatives',
    description: 'Pasteurized whole cows milk (3.5% fat)',
    caloriesPer100g: 62,
    proteinPer100g: 3.3,
    carbsPer100g: 4.8,
    fatPer100g: 3.5,
    servingUnit: 'glass',
    defaultServingSize: 200,
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Unsweetened Almond Milk',
    categoryName: 'Dairy & Alternatives',
    description: 'Plant-based unsweetened almond drink',
    caloriesPer100g: 15,
    proteinPer100g: 0.6,
    carbsPer100g: 0.3,
    fatPer100g: 1.2,
    servingUnit: 'cup',
    defaultServingSize: 240,
    imageUrl: 'https://images.unsplash.com/photo-1568651316335-e6f6630f14dc?w=500&auto=format&fit=crop&q=80',
  },

  // ── 6. VIETNAMESE DISHES ─────────────────────────────────
  {
    name: 'Phở Bò Tái Nạm',
    categoryName: 'Vietnamese Dishes',
    description: 'Traditional Vietnamese beef pho with rare beef flank, broth, and fresh herbs',
    caloriesPer100g: 88,
    proteinPer100g: 5.6,
    carbsPer100g: 12.5,
    fatPer100g: 2.1,
    servingUnit: 'bowl',
    defaultServingSize: 500,
    imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Cơm Tấm Sườn Nướng',
    categoryName: 'Vietnamese Dishes',
    description: 'Vietnamese broken rice with marinated grilled pork chop and scallion oil',
    caloriesPer100g: 165,
    proteinPer100g: 8.5,
    carbsPer100g: 22,
    fatPer100g: 5.1,
    servingUnit: 'plate',
    defaultServingSize: 350,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Bánh Mì Thịt Nguội',
    categoryName: 'Vietnamese Dishes',
    description: 'Crispy baguette with pork ham, pate, cucumber, and pickled daikon',
    caloriesPer100g: 235,
    proteinPer100g: 9.2,
    carbsPer100g: 31,
    fatPer100g: 8.4,
    servingUnit: 'sandwich',
    defaultServingSize: 180,
    imageUrl: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Gỏi Cuốn Tôm Thịt',
    categoryName: 'Vietnamese Dishes',
    description: 'Fresh spring rolls with shrimp, pork, vermicelli, and peanut dipping sauce',
    caloriesPer100g: 110,
    proteinPer100g: 6.8,
    carbsPer100g: 16.5,
    fatPer100g: 2.2,
    servingUnit: 'roll',
    defaultServingSize: 60,
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Bún Chả Hà Nội',
    categoryName: 'Vietnamese Dishes',
    description: 'Hanoi style grilled pork meatballs with rice vermicelli and dipping sauce',
    caloriesPer100g: 135,
    proteinPer100g: 7.2,
    carbsPer100g: 18,
    fatPer100g: 4.1,
    servingUnit: 'set',
    defaultServingSize: 400,
    imageUrl: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&auto=format&fit=crop&q=80',
  },

  // ── 7. SNACKS & BAKERY ───────────────────────────────────
  {
    name: 'Chocolate Chip Cookie',
    categoryName: 'Snacks & Bakery',
    description: 'Baked golden cookie with dark chocolate chips',
    caloriesPer100g: 488,
    proteinPer100g: 5.5,
    carbsPer100g: 64,
    fatPer100g: 24,
    servingUnit: 'cookie',
    defaultServingSize: 30,
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Almonds (Roasted)',
    categoryName: 'Snacks & Bakery',
    description: 'Whole dry roasted unsalted almonds',
    caloriesPer100g: 579,
    proteinPer100g: 21.2,
    carbsPer100g: 21.6,
    fatPer100g: 49.9,
    servingUnit: 'serving',
    defaultServingSize: 28,
    imageUrl: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Chocolate Muffin',
    categoryName: 'Snacks & Bakery',
    description: 'Rich baked cocoa muffin with chocolate drizzle',
    caloriesPer100g: 375,
    proteinPer100g: 5.2,
    carbsPer100g: 51,
    fatPer100g: 17,
    servingUnit: 'muffin',
    defaultServingSize: 115,
    imageUrl: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Peanut Butter',
    categoryName: 'Snacks & Bakery',
    description: '100% natural smooth roasted peanut butter',
    caloriesPer100g: 588,
    proteinPer100g: 25,
    carbsPer100g: 20,
    fatPer100g: 50,
    servingUnit: 'tbsp',
    defaultServingSize: 32,
    imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=500&auto=format&fit=crop&q=80',
  },

  // ── 8. BEVERAGES ─────────────────────────────────────────
  {
    name: 'Americano / Black Coffee',
    categoryName: 'Beverages',
    description: 'Freshly brewed espresso diluted with hot water, zero sugar',
    caloriesPer100g: 2,
    proteinPer100g: 0.1,
    carbsPer100g: 0.3,
    fatPer100g: 0,
    servingUnit: 'cup',
    defaultServingSize: 240,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Vietnamese Iced Milk Coffee (Cà Phê Sữa Đá)',
    categoryName: 'Beverages',
    description: 'Drip filtered coffee with sweetened condensed milk and ice',
    caloriesPer100g: 78,
    proteinPer100g: 1.8,
    carbsPer100g: 12.5,
    fatPer100g: 2.4,
    servingUnit: 'glass',
    defaultServingSize: 250,
    imageUrl: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Green Tea (Unsweetened)',
    categoryName: 'Beverages',
    description: 'Brewed green tea leaves, zero calorie antioxidant drink',
    caloriesPer100g: 1,
    proteinPer100g: 0,
    carbsPer100g: 0.2,
    fatPer100g: 0,
    servingUnit: 'cup',
    defaultServingSize: 200,
    imageUrl: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Fresh Orange Juice',
    categoryName: 'Beverages',
    description: '100% freshly squeezed orange juice, no added sugar',
    caloriesPer100g: 45,
    proteinPer100g: 0.7,
    carbsPer100g: 10.4,
    fatPer100g: 0.2,
    servingUnit: 'glass',
    defaultServingSize: 250,
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
  },
];

async function seedFoods() {
  console.log('🥑 [NutraAI] Seeding Food Categories & Foods with CDN images...');

  // 1. Create or ensure categories exist
  const categoryMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    const existing = await prisma.foodCategory.findFirst({
      where: { name: { equals: cat.name, mode: 'insensitive' } },
    });

    if (existing) {
      categoryMap.set(cat.name, existing.id);
    } else {
      const created = await prisma.foodCategory.create({
        data: {
          id: uuid(),
          name: cat.name,
          description: cat.description,
          sortOrder: cat.sortOrder,
          isActive: true,
        },
      });
      categoryMap.set(cat.name, created.id);
    }
  }

  // 2. Upsert foods
  let upsertedCount = 0;

  for (const item of FOODS) {
    const categoryId = categoryMap.get(item.categoryName) || categoryMap.get('Protein')!;

    const existingFood = await prisma.food.findFirst({
      where: { name: { equals: item.name, mode: 'insensitive' } },
    });

    if (existingFood) {
      await prisma.food.update({
        where: { id: existingFood.id },
        data: {
          categoryId,
          description: item.description,
          caloriesPer100g: item.caloriesPer100g,
          proteinPer100g: item.proteinPer100g,
          carbsPer100g: item.carbsPer100g,
          fatPer100g: item.fatPer100g,
          servingUnit: item.servingUnit,
          defaultServingSize: item.defaultServingSize,
          imageUrl: item.imageUrl,
          isVerified: true,
          isActive: true,
        },
      });
    } else {
      await prisma.food.create({
        data: {
          id: uuid(),
          categoryId,
          name: item.name,
          description: item.description,
          caloriesPer100g: item.caloriesPer100g,
          proteinPer100g: item.proteinPer100g,
          carbsPer100g: item.carbsPer100g,
          fatPer100g: item.fatPer100g,
          servingUnit: item.servingUnit,
          defaultServingSize: item.defaultServingSize,
          imageUrl: item.imageUrl,
          isVerified: true,
          isActive: true,
        },
      });
    }

    upsertedCount++;
  }

  console.log(`✅ [NutraAI] Successfully seeded ${upsertedCount} verified foods with CDN images!\n`);
}

seedFoods()
  .catch((e) => {
    console.error('❌ Error seeding foods:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
