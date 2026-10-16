import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Food, FoodCategory } from '@prisma/client';

@Injectable()
export class FoodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchLocal(query?: string, categoryId?: string): Promise<Food[]> {
    const where: any = { isActive: true };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (query?.trim()) {
      where.name = {
        contains: query.trim(),
        mode: 'insensitive',
      };
    }

    return this.prisma.food.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [
        { isVerified: 'desc' },
        { name: 'asc' },
      ],
      take: 30,
    });
  }

  async findAllCategories(): Promise<FoodCategory[]> {
    return this.prisma.foodCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string): Promise<Food | null> {
    return this.prisma.food.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async findOrCreateCategory(name: string): Promise<FoodCategory> {
    const existing = await this.prisma.foodCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) return existing;

    return this.prisma.foodCategory.create({
      data: {
        name,
        description: `Danh mục ${name}`,
        sortOrder: 99,
      },
    });
  }

  async createFood(data: {
    name: string;
    description?: string;
    categoryId: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    servingUnit?: string;
    defaultServingSize?: number;
    imageUrl?: string;
    isVerified?: boolean;
  }): Promise<Food> {
    return this.prisma.food.create({
      data: {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        caloriesPer100g: data.caloriesPer100g,
        proteinPer100g: data.proteinPer100g,
        carbsPer100g: data.carbsPer100g,
        fatPer100g: data.fatPer100g,
        servingUnit: data.servingUnit || 'g',
        defaultServingSize: data.defaultServingSize || 100,
        imageUrl: data.imageUrl,
        isVerified: data.isVerified ?? false,
      },
      include: {
        category: true,
      },
    });
  }
}
