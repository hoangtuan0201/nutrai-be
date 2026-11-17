import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodsService } from './foods.service';
import { FoodsRepository } from './foods.repository';
import { RedisService } from '../../common/redis/redis.service';

describe('FoodsService', () => {
  let service: FoodsService;
  let repository: jest.Mocked<FoodsRepository>;
  let redisService: jest.Mocked<RedisService>;

  const mockFood = {
    id: 'food-1',
    name: 'Grilled Chicken Breast',
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
  };

  beforeEach(async () => {
    const mockRepo: Partial<jest.Mocked<FoodsRepository>> = {
      searchLocal: jest.fn(),
      findById: jest.fn(),
    };

    const mockRedis: Partial<jest.Mocked<RedisService>> = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: RedisService,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<FoodsService>(FoodsService);
    repository = module.get(FoodsRepository);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchFoods', () => {
    it('should return local items when source is local and cache miss', async () => {
      repository.searchLocal.mockResolvedValue([mockFood as any]);

      const result = await service.searchFoods('chicken', 'local');

      expect(redisService.getJson).toHaveBeenCalledWith('foods:local:q:chicken');
      expect(repository.searchLocal).toHaveBeenCalledWith('chicken');
      expect(redisService.setJson).toHaveBeenCalledWith(
        'foods:local:q:chicken',
        expect.any(Array),
        600,
      );
      expect(result.localItems).toHaveLength(1);
      expect(result.localItems[0].name).toBe('Grilled Chicken Breast');
      expect(result.usdaItems).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('should return cached default foods without hitting repository on cache hit', async () => {
      const cachedItem = {
        id: 'food-1',
        name: 'Grilled Chicken Breast',
        source: 'LOCAL' as const,
        caloriesPer100g: 165,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        servingUnit: 'g',
        defaultServingSize: 100,
      };
      redisService.getJson.mockResolvedValue([cachedItem]);

      const result = await service.searchFoods('', 'local');

      expect(redisService.getJson).toHaveBeenCalledWith('foods:local:default');
      expect(repository.searchLocal).not.toHaveBeenCalled();
      expect(result.localItems).toEqual([cachedItem]);
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
