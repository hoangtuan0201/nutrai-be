import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { MealsService } from './meals.service';
import { MealsRepository } from './meals.repository';
import { MealType, MealSource } from '@prisma/client';

describe('MealsService', () => {
  let service: MealsService;
  let repository: jest.Mocked<MealsRepository>;

  const mockDate = new Date('2026-10-13T10:00:00Z');

  const mockMeal = {
    id: 'meal-123',
    userId: 'user-1',
    mealType: MealType.LUNCH,
    name: 'Grilled Salmon with Rice',
    totalCalories: 550,
    totalProtein: 40,
    totalCarbs: 50,
    totalFat: 18,
    imageUrl: null,
    source: MealSource.MANUAL,
    loggedDate: new Date('2026-10-13T00:00:00Z'),
    loggedAt: mockDate,
    createdAt: mockDate,
    updatedAt: mockDate,
    items: [],
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findByUserAndDate: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealsService,
        {
          provide: MealsRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<MealsService>(MealsService);
    repository = module.get(MealsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMeal', () => {
    it('should delegate meal creation to repository', async () => {
      const dto = {
        mealType: MealType.LUNCH,
        name: 'Lunch',
        totalCalories: 500,
        totalProtein: 30,
        totalCarbs: 60,
        totalFat: 15,
      };

      repository.create.mockResolvedValue(mockMeal as any);

      const result = await service.createMeal('user-1', dto as any);
      expect(repository.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockMeal);
    });
  });

  describe('getDailyMeals', () => {
    it('should aggregate macros and return daily summary', async () => {
      const meal2 = {
        ...mockMeal,
        id: 'meal-456',
        mealType: MealType.DINNER,
        totalCalories: 600,
        totalProtein: 45,
        totalCarbs: 60,
        totalFat: 20,
      };

      repository.findByUserAndDate.mockResolvedValue([mockMeal, meal2] as any);

      const result = await service.getDailyMeals('user-1', '2026-10-13');

      expect(repository.findByUserAndDate).toHaveBeenCalled();
      expect(result.summary.totalCalories).toBe(1150);
      expect(result.summary.totalProtein).toBe(85);
      expect(result.summary.totalCarbs).toBe(110);
      expect(result.summary.totalFat).toBe(38);
      expect(result.summary.mealCount).toBe(2);
      expect(result.meals).toHaveLength(2);
    });

    it('should throw BadRequestException on invalid date string', async () => {
      await expect(service.getDailyMeals('user-1', 'not-a-date')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMealById', () => {
    it('should return the meal when user matches', async () => {
      repository.findById.mockResolvedValue(mockMeal as any);

      const result = await service.getMealById('user-1', 'meal-123');
      expect(result).toEqual(mockMeal);
    });

    it('should throw NotFoundException if meal does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getMealById('user-1', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if meal belongs to another user', async () => {
      repository.findById.mockResolvedValue(mockMeal as any);

      await expect(service.getMealById('other-user', 'meal-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteMeal', () => {
    it('should delete meal and return success message', async () => {
      repository.findById.mockResolvedValue(mockMeal as any);
      repository.delete.mockResolvedValue(mockMeal as any);

      const result = await service.deleteMeal('user-1', 'meal-123');
      expect(repository.delete).toHaveBeenCalledWith('meal-123');
      expect(result.success).toBe(true);
    });
  });
});
