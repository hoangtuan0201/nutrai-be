import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { Meal, MealType, MealSource } from '@prisma/client';
import { getVietnamDayRange, getVietnamTodayString } from '../../common/utils/date.util';

@Injectable()
export class MealsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMealDto): Promise<Meal> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${userId}' does not exist.`);
    }

    const { loggedDate, dateString } = getVietnamDayRange(dto.loggedDate);
    const now = new Date();
    let loggedAt = now;

    // If logging for a different calendar date than today, align loggedAt's date to loggedDate (preserving current time-of-day in UTC+7)
    if (dateString !== getVietnamTodayString()) {
      const [year, month, day] = dateString.split('-').map(Number);
      const vnNow = new Date(now.getTime() + 7 * 3600000);
      loggedAt = new Date(
        Date.UTC(
          year,
          month - 1,
          day,
          vnNow.getUTCHours() - 7,
          vnNow.getUTCMinutes(),
          vnNow.getUTCSeconds(),
          vnNow.getUTCMilliseconds(),
        ),
      );
    }

    return this.prisma.meal.create({
      data: {
        userId,
        mealType: dto.mealType as MealType,
        name: dto.name,
        totalCalories: dto.totalCalories,
        totalProtein: dto.totalProtein,
        totalCarbs: dto.totalCarbs,
        totalFat: dto.totalFat,
        imageUrl: dto.imageUrl,
        source: (dto.source as MealSource) || MealSource.MANUAL,
        loggedDate,
        loggedAt,
        items: dto.items?.length
          ? {
              create: dto.items.map((item, index) => ({
                foodName: item.foodName,
                portionDescription: item.portionDescription,
                quantity: item.quantity,
                unit: item.unit || 'serving',
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
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<Meal[]> {
    return this.prisma.meal.findMany({
      where: { userId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: {
        loggedAt: 'desc',
      },
    });
  }

  async findByUserAndDate(
    userId: string,
    loggedDate: Date,
    _startUtc?: Date,
    _endUtc?: Date,
  ): Promise<Meal[]> {
    return this.prisma.meal.findMany({
      where: {
        userId,
        loggedDate,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: {
        loggedAt: 'asc',
      },
    });
  }

  async findById(id: string): Promise<Meal | null> {
    return this.prisma.meal.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async delete(id: string): Promise<Meal> {
    return this.prisma.meal.delete({
      where: { id },
    });
  }
}
