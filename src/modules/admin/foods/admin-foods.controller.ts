import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../common/admin-only.decorator';
import { AdminFoodsService } from './admin-foods.service';
import { CreateFoodDto, QueryAdminFoodsDto, UpdateFoodDto } from './dto/food.dto';

@ApiTags('Admin - Food Database')
@AdminOnly()
@Controller('admin')
export class AdminFoodsController {
  constructor(private readonly foodsService: AdminFoodsService) {}

  // ─── Foods ───────────────────────────────────────────────────

  /**
   * GET /admin/foods — Danh sách món ăn phân trang (tìm kiếm, lọc active/verified)
   */
  @Get('foods')
  @ApiOperation({ summary: 'List foods (search, filter by active / verified)' })
  @ApiOkResponse({ description: 'Paginated food list' })
  listFoods(@Query() query: QueryAdminFoodsDto) {
    return this.foodsService.listFoods(query);
  }

  /**
   * GET /admin/foods/:id — Xem chi tiết 1 món ăn trong kho
   */
  @Get('foods/:id')
  @ApiOperation({ summary: 'Get food detail' })
  @ApiNotFoundResponse({ description: 'Food not found' })
  getFood(@Param('id') id: string) {
    return this.foodsService.getFood(id);
  }

  /**
   * POST /admin/foods — Tạo món ăn mới (upload ảnh Cloudinary + xóa Redis cache)
   */
  @Post('foods')
  @ApiOperation({ summary: 'Create a standard food (optional image upload to Cloudinary)' })
  @ApiCreatedResponse({ description: 'Food created' })
  createFood(@Body() dto: CreateFoodDto) {
    return this.foodsService.createFood(dto);
  }

  /**
   * PATCH /admin/foods/:id — Cập nhật món ăn (đổi/xóa ảnh + xóa Redis cache)
   */
  @Patch('foods/:id')
  @ApiOperation({ summary: 'Update a food (replace or remove image)' })
  @ApiNotFoundResponse({ description: 'Food not found' })
  updateFood(@Param('id') id: string, @Body() dto: UpdateFoodDto) {
    return this.foodsService.updateFood(id, dto);
  }

  /**
   * DELETE /admin/foods/:id — Ẩn (soft delete) món ăn khỏi tìm kiếm + xóa Redis cache
   */
  @Delete('foods/:id')
  @ApiOperation({ summary: 'Deactivate (soft delete) a food' })
  @ApiNotFoundResponse({ description: 'Food not found' })
  deactivateFood(@Param('id') id: string) {
    return this.foodsService.deactivateFood(id);
  }
}

