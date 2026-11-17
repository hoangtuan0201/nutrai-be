import {
  Controller,
  Get,
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

  /**
   * GET /foods/search — Tìm kiếm món ăn từ DB nội bộ & USDA API (có Redis Cache)
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Search foods from internal database and USDA FoodData Central API',
  })
  @ApiResponse({ status: 200, description: 'Search results returned successfully.' })
  async searchFoods(@Query() query: SearchFoodQueryDto) {
    return this.foodsService.searchFoods(query.query, query.source);
  }

  /**
   * GET /foods/barcode/:barcode — Tra cứu thông tin dinh dưỡng sản phẩm theo mã vạch
   */
  @Get('barcode/:barcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lookup packaged food nutrition by barcode without saving to internal database' })
  @ApiResponse({ status: 200, description: 'Food details returned from external barcode database.' })
  @ApiResponse({ status: 404, description: 'Product not found for this barcode.' })
  async getFoodByBarcode(@Param('barcode') barcode: string) {
    return this.foodsService.getFoodByBarcode(barcode);
  }

  /**
   * GET /foods/:id — Lấy chi tiết 1 món ăn trong DB nội bộ theo ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get internal food item details by ID' })
  @ApiResponse({ status: 200, description: 'Food details returned.' })
  @ApiResponse({ status: 404, description: 'Food item not found.' })
  async getFoodById(@Param('id') id: string) {
    return this.foodsService.getFoodById(id);
  }
}
