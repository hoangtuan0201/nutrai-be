import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
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
                foodId: item.foodId || undefined,
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
          include: {
            food: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
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
          include: {
            food: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async update(id: string, dto: UpdateMealDto): Promise<Meal> {
    return this.prisma.$transaction(async (tx) => {
      let totalCalories = dto.totalCalories;
      let totalProtein = dto.totalProtein;
      let totalCarbs = dto.totalCarbs;
      let totalFat = dto.totalFat;

      if (dto.items !== undefined) {
        // Remove existing items and replace with updated ones
        await tx.mealItem.deleteMany({
          where: { mealId: id },
        });

        if (dto.items.length > 0) {
          await tx.mealItem.createMany({
            data: dto.items.map((item, index) => ({
              mealId: id,
              foodName: item.foodName,
              portionDescription: item.portionDescription,
              quantity: item.quantity,
              unit: item.unit || 'serving',
              calories: Math.round(item.calories),
              protein: Math.round(item.protein * 10) / 10,
              carbs: Math.round(item.carbs * 10) / 10,
              fat: Math.round(item.fat * 10) / 10,
              sortOrder: index,
            })),
          });

          if (totalCalories === undefined) {
            totalCalories = Math.round(dto.items.reduce((sum, it) => sum + it.calories, 0));
          }
          if (totalProtein === undefined) {
            totalProtein = Math.round(dto.items.reduce((sum, it) => sum + it.protein, 0) * 10) / 10;
          }
          if (totalCarbs === undefined) {
            totalCarbs = Math.round(dto.items.reduce((sum, it) => sum + it.carbs, 0) * 10) / 10;
          }
          if (totalFat === undefined) {
            totalFat = Math.round(dto.items.reduce((sum, it) => sum + it.fat, 0) * 10) / 10;
          }
        } else {
          totalCalories = totalCalories ?? 0;
          totalProtein = totalProtein ?? 0;
          totalCarbs = totalCarbs ?? 0;
          totalFat = totalFat ?? 0;
        }
      }

      return tx.meal.update({
        where: { id },
        data: {
          name: dto.name,
          mealType: dto.mealType,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
          imageUrl: dto.imageUrl,
        },
        include: {
          items: {
            include: {
              food: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });
  }

  async delete(id: string): Promise<Meal> {
    return this.prisma.meal.delete({
      where: { id },
    });
  }
}
