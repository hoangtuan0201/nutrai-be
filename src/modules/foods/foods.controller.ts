import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FoodsService } from './foods.service';
import { SearchFoodQueryDto } from './dto/search-food-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Foods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Search foods from internal database and USDA FoodData Central API',
  })
  @ApiResponse({ status: 200, description: 'Search results returned successfully.' })
  async searchFoods(@Query() query: SearchFoodQueryDto) {
    return this.foodsService.searchFoods(query.query, query.categoryId, query.source);
  }

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all internal food categories' })
  @ApiResponse({ status: 200, description: 'List of food categories.' })
  async getCategories() {
    return this.foodsService.getCategories();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get internal food item details by ID' })
  @ApiResponse({ status: 200, description: 'Food details returned.' })
  @ApiResponse({ status: 404, description: 'Food item not found.' })
  async getFoodById(@Param('id') id: string) {
    return this.foodsService.getFoodById(id);
  }

  @Post('import-usda')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Import or save a USDA food item to internal database' })
  @ApiResponse({ status: 201, description: 'Food item saved to internal database.' })
  async importUsdaFood(
    @Body()
    dto: {
      name: string;
      caloriesPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
      servingUnit?: string;
      defaultServingSize?: number;
      categoryName?: string;
    },
  ) {
    return this.foodsService.saveUsdaFoodToLocal(dto);
  }
}
