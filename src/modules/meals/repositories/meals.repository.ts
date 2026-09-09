import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CreateMealDto } from '../dto/create-meal.dto';
import { Meal, MealType, MealSource } from '@prisma/client';

@Injectable()
export class MealsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateMealDto): Promise<Meal> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${dto.userId}' does not exist.`);
    }

    return this.prisma.meal.create({
      data: {
        userId: dto.userId,
        mealType: dto.mealType as MealType,
        name: dto.name,
        totalCalories: dto.totalCalories,
        totalProtein: dto.totalProtein,
        totalCarbs: dto.totalCarbs,
        totalFat: dto.totalFat,
        imageUrl: dto.imageUrl,
        source: (dto.source as MealSource) || MealSource.MANUAL,
        loggedDate: new Date(),
        loggedAt: new Date(),
        items: dto.items?.length
          ? {
              create: dto.items.map((item, index) => ({
                foodName: item.foodName,
                portionDescription: item.portionDescription,
                quantity: item.quantity,
                unit: item.unit,
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        items: true,
      },
    });
  }

  async findByUserId(userId: string): Promise<Meal[]> {
    return this.prisma.meal.findMany({
      where: {
        userId,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
