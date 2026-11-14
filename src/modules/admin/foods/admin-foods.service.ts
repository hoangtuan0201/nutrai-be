import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import { toPaginated, toSkipTake } from '../common/pagination';
import { CreateFoodDto, QueryAdminFoodsDto, UpdateFoodDto } from './dto/food.dto';

const FOOD_IMAGE_FOLDER = 'nutraai/foods';

@Injectable()
export class AdminFoodsService {
  private readonly logger = new Logger(AdminFoodsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ─── Foods ───────────────────────────────────────────────────

  async listFoods(query: QueryAdminFoodsDto) {
    const search = query.search?.trim();
    const where: Prisma.FoodWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.isVerified !== undefined ? { isVerified: query.isVerified } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.food.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...toSkipTake(query.page, query.limit),
      }),
      this.prisma.food.count({ where }),
    ]);
    return toPaginated(items, total, query.page, query.limit);
  }

  async getFood(id: string) {
    const food = await this.prisma.food.findUnique({
      where: { id },
    });
    if (!food) throw new NotFoundException('Food not found');
    return food;
  }

  async createFood(dto: CreateFoodDto) {
    const { imageBase64, ...data } = dto;
    const imageUrl = imageBase64 ? await this.uploadFoodImage(imageBase64) : undefined;

    return this.prisma.food.create({
      data: { ...data, isVerified: data.isVerified ?? true, imageUrl },
    });
  }

  async updateFood(id: string, dto: UpdateFoodDto) {
    await this.getFood(id);
    const { imageBase64, removeImage, ...data } = dto;

    let imageUrl: string | null | undefined;
    if (imageBase64) imageUrl = await this.uploadFoodImage(imageBase64);
    else if (removeImage) imageUrl = null;

    return this.prisma.food.update({
      where: { id },
      data: { ...data, ...(imageUrl !== undefined ? { imageUrl } : {}) },
    });
  }

  /** Soft delete: meal history keeps referencing the food, but it disappears from search. */
  async deactivateFood(id: string) {
    await this.getFood(id);
    await this.prisma.food.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async uploadFoodImage(imageBase64: string): Promise<string> {
    try {
      return await this.cloudinary.uploadImage(imageBase64, FOOD_IMAGE_FOLDER);
    } catch (err) {
      this.logger.warn(`Cloudinary upload failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not upload food image. Please try another image.');
    }
  }

  private mapUniqueError(err: unknown, message: string) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException(message);
    }
    return err;
  }
}

