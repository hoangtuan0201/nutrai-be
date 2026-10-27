import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodsRepository } from './foods.repository';

export interface StandardFoodItem {
  id?: string;
  name: string;
  source: 'LOCAL' | 'USDA' | 'BARCODE';
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
  barcode?: string;
  imageUrl?: string;
  servingSizeDescription?: string;
  servingCalories?: number;
  servingProtein?: number;
  servingCarbs?: number;
  servingFat?: number;
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
        imageUrl: f.imageUrl || undefined,
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
   * Ưu tiên dữ liệu Foundation, SR Legacy và FNDDS để đảm bảo độ chính xác
   */
  private async fetchUsdaFoods(query: string): Promise<StandardFoodItem[]> {
    const dataTypes = encodeURIComponent('Foundation,Survey (FNDDS),SR Legacy,Branded');
    const url = `${this.usdaApiUrl}?query=${encodeURIComponent(query)}&pageSize=15&dataType=${dataTypes}&api_key=${this.usdaApiKey}`;
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

      // 1. Lấy Energy chính xác (ưu tiên kcal, xử lý nếu nutrient là kJ)
      let calories = 0;
      const energyKcal = nutrients.find(
        (n: any) =>
          n.nutrientId === 1008 ||
          (n.unitName?.toUpperCase() === 'KCAL' && n.nutrientName?.toLowerCase().includes('energy')),
      );

      if (energyKcal?.value != null) {
        calories = Number(energyKcal.value);
      } else {
        // Kiểm tra kJ (nutrientId 1062)
        const energyKj = nutrients.find(
          (n: any) =>
            n.nutrientId === 1062 ||
            (n.unitName?.toUpperCase() === 'KJ' && n.nutrientName?.toLowerCase().includes('energy')),
        );
        if (energyKj?.value != null) {
          calories = Math.round(Number(energyKj.value) / 4.184);
        }
      }

      // 2. Lấy Protein, Fat, Carbs
      const findNutrient = (id: number, names: string[]): number => {
        const found = nutrients.find(
          (n: any) =>
            n.nutrientId === id ||
            names.some((name) => n.nutrientName?.toLowerCase().includes(name.toLowerCase())),
        );
        return found?.value != null ? Number(found.value) : 0;
      };

      const protein = findNutrient(1003, ['protein']);
      const fat = findNutrient(1004, ['total lipid', 'fat']);
      const carbs = findNutrient(1005, ['carbohydrate']);

      // 3. Fallback: Nếu không có calories nhưng có macros, dùng công thức Atwater
      if (calories <= 0 && (protein > 0 || carbs > 0 || fat > 0)) {
        calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
      }

      // Loại bỏ dữ liệu rác (tất cả chỉ số đều = 0 hoặc calo vô lý > 950 kcal/100g)
      if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) {
        continue;
      }
      if (calories > 950) {
        // Thường là do nhập nhầm kJ hoặc số liệu lỗi
        continue;
      }

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

  /**
   * Lookup packaged food information by barcode without storing to internal database.
   * Primary: Open Food Facts API v2.
   * Fallback: Gemini AI Knowledge lookup for commercial barcode numbers.
   */
  async getFoodByBarcode(barcode: string): Promise<StandardFoodItem> {
    const cleanBarcode = barcode.trim().replace(/[^0-9]/g, '');
    if (!cleanBarcode) {
      throw new NotFoundException('Invalid barcode format');
    }

    // 1. Tra cứu Open Food Facts API v2
    try {
      const offUrl = `https://world.openfoodfacts.net/api/v2/product/${cleanBarcode}?fields=product_name,product_name_vi,product_name_en,brands,nutriments,image_url,serving_size,serving_quantity`;
      const offRes = await fetch(offUrl, {
        headers: {
          'User-Agent': 'NutraAI - Mobile - Version 1.0 - contact@nutraai.com',
          Accept: 'application/json',
        },
      });

      if (offRes.ok) {
        const offData = await offRes.json();
        if (offData.status === 1 && offData.product) {
          const p = offData.product;
          const nutriments = p.nutriments || {};

          const calories100g =
            nutriments['energy-kcal_100g'] ??
            nutriments['energy-kcal'] ??
            (nutriments.energy_100g ? Math.round(nutriments.energy_100g / 4.184) : 0);

          const protein100g = nutriments.proteins_100g ?? nutriments.proteins ?? 0;
          const carbs100g = nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0;
          const fat100g = nutriments.fat_100g ?? nutriments.fat ?? 0;

          const productName =
            p.product_name_vi || p.product_name || p.product_name_en || 'Packaged Product';

          const servingSizeDesc =
            p.serving_size ||
            (p.serving_quantity ? `${p.serving_quantity}g` : '1 package');
          const servingQty = p.serving_quantity ? Number(p.serving_quantity) : 0;

          let servingCal = nutriments['energy-kcal_serving']
            ? Math.round(Number(nutriments['energy-kcal_serving']))
            : 0;
          let servingProt = nutriments['proteins_serving']
            ? Math.round(Number(nutriments['proteins_serving']) * 10) / 10
            : 0;
          let servingCarb = nutriments['carbohydrates_serving']
            ? Math.round(Number(nutriments['carbohydrates_serving']) * 10) / 10
            : 0;
          let servingFa = nutriments['fat_serving']
            ? Math.round(Number(nutriments['fat_serving']) * 10) / 10
            : 0;

          if (!servingCal && servingQty > 0 && Number(calories100g) > 0) {
            const factor = servingQty / 100;
            servingCal = Math.round(Number(calories100g) * factor);
            servingProt = Math.round(Number(protein100g) * factor * 10) / 10;
            servingCarb = Math.round(Number(carbs100g) * factor * 10) / 10;
            servingFa = Math.round(Number(fat100g) * factor * 10) / 10;
          } else if (!servingCal && Number(calories100g) > 0) {
            servingCal = Math.round(Number(calories100g));
            servingProt = Math.round(Number(protein100g) * 10) / 10;
            servingCarb = Math.round(Number(carbs100g) * 10) / 10;
            servingFa = Math.round(Number(fat100g) * 10) / 10;
          }

          return {
            name: productName.trim(),
            brand: p.brands || undefined,
            source: 'BARCODE',
            barcode: cleanBarcode,
            categoryName: 'Packaged Food',
            caloriesPer100g: Math.round(Number(calories100g) * 10) / 10,
            proteinPer100g: Math.round(Number(protein100g) * 10) / 10,
            carbsPer100g: Math.round(Number(carbs100g) * 10) / 10,
            fatPer100g: Math.round(Number(fat100g) * 10) / 10,
            servingUnit: 'serving',
            defaultServingSize: 1,
            servingSizeDescription: servingSizeDesc,
            servingCalories: servingCal,
            servingProtein: servingProt,
            servingCarbs: servingCarb,
            servingFat: servingFa,
            imageUrl: p.image_url || undefined,
            isVerified: true,
          };
        }
      }
    } catch (offErr: any) {
      this.logger.warn(`Open Food Facts lookup failed: ${offErr.message}`);
    }

    // 2. Dự phòng bằng Gemini AI Knowledge (Hỗ trợ hàng Việt Nam & Châu Á)
    const geminiKey = this.configService.get<string>('GEMINI_API_SCANFOOD');
    if (geminiKey) {
      try {
        const promptText = `
The user scanned a commercial barcode: "${cleanBarcode}".
Identify the exact commercial packaged food product (brand, item name, standard serving size description, and nutritional values per package/serving) corresponding to this EAN-13/UPC barcode number.
If found with confidence, return valid JSON:
{
  "found": true,
  "name": "Exact product name (in Vietnamese or English)",
  "brand": "Brand manufacturer (e.g. Vinamilk, Acecook, Nestle)",
  "servingSizeDescription": "1 gói (75g)" or "1 lon (330ml)" or "1 package",
  "servingCalories": number,
  "servingProtein": number,
  "servingCarbs": number,
  "servingFat": number,
  "caloriesPer100g": number,
  "proteinPer100g": number,
  "carbsPer100g": number,
  "fatPer100g": number
}
If unknown or unable to identify this barcode, return:
{ "found": false }
`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
            }),
          },
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.found && parsed.name) {
              const servingCal = parsed.servingCalories ?? parsed.caloriesPer100g ?? 0;
              const servingProt = parsed.servingProtein ?? parsed.proteinPer100g ?? 0;
              const servingCarb = parsed.servingCarbs ?? parsed.carbsPer100g ?? 0;
              const servingFa = parsed.servingFat ?? parsed.fatPer100g ?? 0;

              return {
                name: parsed.name,
                brand: parsed.brand || undefined,
                source: 'BARCODE',
                barcode: cleanBarcode,
                categoryName: 'Packaged Food',
                caloriesPer100g: Math.round(Number(parsed.caloriesPer100g || servingCal) * 10) / 10,
                proteinPer100g: Math.round(Number(parsed.proteinPer100g || servingProt) * 10) / 10,
                carbsPer100g: Math.round(Number(parsed.carbsPer100g || servingCarb) * 10) / 10,
                fatPer100g: Math.round(Number(parsed.fatPer100g || servingFa) * 10) / 10,
                servingUnit: 'serving',
                defaultServingSize: 1,
                servingSizeDescription: parsed.servingSizeDescription || '1 package',
                servingCalories: Math.round(Number(servingCal)),
                servingProtein: Math.round(Number(servingProt) * 10) / 10,
                servingCarbs: Math.round(Number(servingCarb) * 10) / 10,
                servingFat: Math.round(Number(servingFa) * 10) / 10,
                isVerified: false,
              };
            }
          }
        }
      } catch (geminiErr: any) {
        this.logger.warn(`Gemini barcode lookup failed: ${geminiErr.message}`);
      }
    }

    throw new NotFoundException(`No food product found for barcode: ${cleanBarcode}`);
  }
}


