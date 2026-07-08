import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CreateMealDto } from '../dto/create-meal.dto';
import { MealLog } from '@prisma/client';

@Injectable()
export class MealsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMealDto): Promise<MealLog> {
    return this.prisma.mealLog.create({
      data: {
        userId: dto.userId,
        description: dto.description,
        calories: dto.calories,
        protein: dto.protein,
        carbs: dto.carbs,
        fat: dto.fat,
        confidence: dto.confidence,
      },
    });
  }

  async findByUserId(userId: string): Promise<MealLog[]> {
    return this.prisma.mealLog.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
