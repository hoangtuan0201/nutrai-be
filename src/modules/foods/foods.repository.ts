import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Food } from '@prisma/client';

@Injectable()
export class FoodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchLocal(query?: string): Promise<Food[]> {
    const where: any = { isActive: true };

    if (query?.trim()) {
      where.name = {
        contains: query.trim(),
        mode: 'insensitive',
      };
    }

    return this.prisma.food.findMany({
      where,
      orderBy: [
        { isVerified: 'desc' },
        { name: 'asc' },
      ],
      take: query?.trim() ? 30 : 10,
    });
  }

  async findById(id: string): Promise<Food | null> {
    return this.prisma.food.findUnique({
      where: { id },
    });
  }
}
