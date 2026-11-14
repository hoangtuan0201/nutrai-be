import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Food } from '@prisma/client';

@Injectable()
export class FoodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchLocal(query?: string): Promise<Food[]> {
    const where: any = { isActive: true };

    if (query?.trim()) {
      where.name = {
        contains: query.trim(),
        mode: 'insensitive',
      };
    }

    return this.prisma.food.findMany({
      where,
      orderBy: [
        { isVerified: 'desc' },
        { name: 'asc' },
      ],
      take: query?.trim() ? 30 : 10,
    });
  }

  async findById(id: string): Promise<Food | null> {
    return this.prisma.food.findUnique({
      where: { id },
    });
  }

  async createFood(data: {
    name: string;
    description?: string;
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
        caloriesPer100g: data.caloriesPer100g,
        proteinPer100g: data.proteinPer100g,
        carbsPer100g: data.carbsPer100g,
        fatPer100g: data.fatPer100g,
        servingUnit: data.servingUnit || 'g',
        defaultServingSize: data.defaultServingSize || 100,
        imageUrl: data.imageUrl,
        isVerified: data.isVerified ?? false,
      },
    });
  }
}
