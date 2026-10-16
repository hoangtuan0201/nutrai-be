import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodsRepository } from './foods.repository';

export interface StandardFoodItem {
  id?: string;
  name: string;
  source: 'LOCAL' | 'USDA';
  categoryName?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingUnit: string;
  defaultServingSize: number;
  isVerified?: boolean;
  fdcId?: number;
  brand?: string;
}

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);
  private readonly usdaApiKey: string;
  private readonly usdaApiUrl = 'https://api.nal.usda.gov/fdc/v1/foods/search';

  constructor(
    private readonly foodsRepository: FoodsRepository,
    private readonly configService: ConfigService,
  ) {
    this.usdaApiKey =
      this.configService.get<string>('USDA_API_KEY') ||
      process.env.USDA_API_KEY ||
      '';
  }

  async searchFoods(
    query?: string,
    categoryId?: string,
    source: 'all' | 'local' | 'usda' = 'all',
  ): Promise<{
    localItems: StandardFoodItem[];
    usdaItems: StandardFoodItem[];
    total: number;
  }> {
    const trimmedQuery = query?.trim() || '';
    let localItems: StandardFoodItem[] = [];
    let usdaItems: StandardFoodItem[] = [];

    // 1. Tìm kiếm trong Database nội bộ
    if (source === 'all' || source === 'local') {
      const localFoods = await this.foodsRepository.searchLocal(trimmedQuery, categoryId);
      localItems = localFoods.map((f: any) => ({
        id: f.id,
        name: f.name,
        source: 'LOCAL',
        categoryName: f.category?.name || 'Chung',
        caloriesPer100g: f.caloriesPer100g,
        proteinPer100g: f.proteinPer100g,
        carbsPer100g: f.carbsPer100g,
        fatPer100g: f.fatPer100g,
        servingUnit: f.servingUnit,
        defaultServingSize: f.defaultServingSize,
        isVerified: f.isVerified,
      }));
    }

    // 2. Tìm kiếm qua USDA API nếu có từ khóa và source cho phép
    if ((source === 'all' || source === 'usda') && trimmedQuery.length >= 2) {
      try {
        usdaItems = await this.fetchUsdaFoods(trimmedQuery);
      } catch (error: any) {
        this.logger.warn(`Lỗi khi gọi USDA API (${trimmedQuery}): ${error.message}`);
        usdaItems = [];
      }
    }

    return {
      localItems,
      usdaItems,
      total: localItems.length + usdaItems.length,
    };
  }

  async getCategories() {
    return this.foodsRepository.findAllCategories();
  }

  async getFoodById(id: string) {
    const food = await this.foodsRepository.findById(id);
    if (!food) {
      throw new NotFoundException(`Không tìm thấy món ăn với ID '${id}'.`);
    }
    return food;
  }

  /**
   * Lưu nhanh món ăn từ USDA vào cơ sở dữ liệu nội bộ PostgreSQL để tái sử dụng
   */
  async saveUsdaFoodToLocal(item: {
    name: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    servingUnit?: string;
    defaultServingSize?: number;
    categoryName?: string;
  }) {
    const category = await this.foodsRepository.findOrCreateCategory(
      item.categoryName || 'USDA Import',
    );

    return this.foodsRepository.createFood({
      name: item.name,
      categoryId: category.id,
      caloriesPer100g: Math.round(item.caloriesPer100g * 10) / 10,
      proteinPer100g: Math.round(item.proteinPer100g * 10) / 10,
      carbsPer100g: Math.round(item.carbsPer100g * 10) / 10,
      fatPer100g: Math.round(item.fatPer100g * 10) / 10,
      servingUnit: item.servingUnit || 'g',
      defaultServingSize: item.defaultServingSize || 100,
      isVerified: true,
    });
  }

  /**
   * Gọi USDA FoodData Central API và bóc tách thành chuẩn dinh dưỡng
   */
  private async fetchUsdaFoods(query: string): Promise<StandardFoodItem[]> {
    const url = `${this.usdaApiUrl}?query=${encodeURIComponent(query)}&pageSize=10&api_key=${this.usdaApiKey}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      throw new Error(`USDA API trả về mã lỗi HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.foods || !Array.isArray(data.foods)) {
      return [];
    }

    const seenNames = new Set<string>();
    const uniqueFoods: StandardFoodItem[] = [];

    for (const food of data.foods) {
      const nutrients = food.foodNutrients || [];

      // Helper lấy giá trị dinh dưỡng theo ID hoặc tên
      const findNutrient = (id: number, names: string[]): number => {
        const found = nutrients.find(
          (n: any) =>
            n.nutrientId === id ||
            names.some((name) => n.nutrientName?.toLowerCase().includes(name.toLowerCase())),
        );
        return found?.value ? Number(found.value) : 0;
      };

      const calories = findNutrient(1008, ['energy']);
      const protein = findNutrient(1003, ['protein']);
      const fat = findNutrient(1004, ['total lipid', 'fat']);
      const carbs = findNutrient(1005, ['carbohydrate']);

      let rawName = (food.description || '').trim();
      if (!rawName) continue;

      // Deduplicate key by normalized lower case name
      const normKey = rawName.toLowerCase();
      if (seenNames.has(normKey)) {
        continue;
      }
      seenNames.add(normKey);

      // Convert ALL-CAPS to readable Title Case if mostly uppercase
      let cleanName = rawName;
      if (rawName === rawName.toUpperCase() && rawName.length > 3) {
        cleanName = rawName
          .toLowerCase()
          .replace(/(?:^|\s|\/|,|-)\w/g, (c: string) => c.toUpperCase());
      }

      uniqueFoods.push({
        name: cleanName,
        source: 'USDA',
        brand: food.brandOwner || food.brandName || undefined,
        fdcId: food.fdcId,
        caloriesPer100g: Math.round(calories * 10) / 10,
        proteinPer100g: Math.round(protein * 10) / 10,
        carbsPer100g: Math.round(carbs * 10) / 10,
        fatPer100g: Math.round(fat * 10) / 10,
        servingUnit: food.servingSizeUnit || 'g',
        defaultServingSize: food.servingSize ? Number(food.servingSize) : 100,
        categoryName: food.foodCategory || 'USDA Food',
        isVerified: true,
      });

      if (uniqueFoods.length >= 10) break;
    }

    return uniqueFoods;
  }
}
