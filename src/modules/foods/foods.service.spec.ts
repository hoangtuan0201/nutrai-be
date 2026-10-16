import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodsService } from './foods.service';
import { FoodsRepository } from './foods.repository';

describe('FoodsService', () => {
  let service: FoodsService;
  let repository: jest.Mocked<FoodsRepository>;

  const mockFood = {
    id: 'food-1',
    name: 'Grilled Chicken Breast',
    categoryId: 'cat-1',
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    servingUnit: 'g',
    defaultServingSize: 100,
    imageUrl: null,
    isVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: 'cat-1',
      name: 'Poultry',
      description: null,
      iconUrl: null,
      sortOrder: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    const mockRepo: Partial<jest.Mocked<FoodsRepository>> = {
      searchLocal: jest.fn(),
      findAllCategories: jest.fn(),
      findById: jest.fn(),
      findOrCreateCategory: jest.fn(),
      createFood: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodsService,
        {
          provide: FoodsRepository,
          useValue: mockRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-usda-key'),
          },
        },
      ],
    }).compile();

    service = module.get<FoodsService>(FoodsService);
    repository = module.get(FoodsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchFoods', () => {
    it('should return local items when source is local', async () => {
      repository.searchLocal.mockResolvedValue([mockFood as any]);

      const result = await service.searchFoods('chicken', undefined, 'local');

      expect(repository.searchLocal).toHaveBeenCalledWith('chicken', undefined);
      expect(result.localItems).toHaveLength(1);
      expect(result.localItems[0].name).toBe('Grilled Chicken Breast');
      expect(result.usdaItems).toHaveLength(0);
      expect(result.total).toBe(1);
    });
  });

  describe('getFoodById', () => {
    it('should return food when found', async () => {
      repository.findById.mockResolvedValue(mockFood as any);

      const result = await service.getFoodById('food-1');
      expect(result).toEqual(mockFood);
    });

    it('should throw NotFoundException when food not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getFoodById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
