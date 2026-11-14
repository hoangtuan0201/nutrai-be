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

  @Get('foods')
  @ApiOperation({ summary: 'List foods (search, filter by active / verified)' })
  @ApiOkResponse({ description: 'Paginated food list' })
  listFoods(@Query() query: QueryAdminFoodsDto) {
    return this.foodsService.listFoods(query);
  }

  @Get('foods/:id')
  @ApiOperation({ summary: 'Get food detail' })
  @ApiNotFoundResponse({ description: 'Food not found' })
  getFood(@Param('id') id: string) {
    return this.foodsService.getFood(id);
  }

  @Post('foods')
  @ApiOperation({ summary: 'Create a standard food (optional image upload to Cloudinary)' })
  @ApiCreatedResponse({ description: 'Food created' })
  createFood(@Body() dto: CreateFoodDto) {
    return this.foodsService.createFood(dto);
  }

  @Patch('foods/:id')
  @ApiOperation({ summary: 'Update a food (replace or remove image)' })
  @ApiNotFoundResponse({ description: 'Food not found' })
  updateFood(@Param('id') id: string, @Body() dto: UpdateFoodDto) {
    return this.foodsService.updateFood(id, dto);
  }

  @Delete('foods/:id')
  @ApiOperation({ summary: 'Deactivate (soft delete) a food' })
  @ApiNotFoundResponse({ description: 'Food not found' })
  deactivateFood(@Param('id') id: string) {
    return this.foodsService.deactivateFood(id);
  }
}

