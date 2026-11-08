import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MealsService } from './meals.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { GetDailyMealsQueryDto } from './dto/get-daily-meals-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Meals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Create a new meal log for authenticated user' })
  @ApiResponse({ status: 201, description: 'Meal log successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createMeal(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMealDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.mealsService.createMeal(user.id, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Get meals of current user (optionally filtered by date YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'List of meals returned.' })
  async getMeals(
    @CurrentUser() user: AuthUser,
    @Query() query: GetDailyMealsQueryDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    if (query?.date) {
      return this.mealsService.getDailyMeals(user.id, query.date);
    }
    return this.mealsService.getMealsByUser(user.id);
  }

  @Get('today')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get today's meals and nutrition summary" })
  @ApiResponse({ status: 200, description: "Today's meals and summary returned." })
  async getTodayMeals(@CurrentUser() user: AuthUser) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.mealsService.getDailyMeals(user.id);
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all meal logs of a specific user (legacy compatibility)' })
  @ApiResponse({ status: 200, description: 'List of meal logs returned.' })
  async getMealsByUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.mealsService.getMealsByUser(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get meal detail by ID' })
  @ApiResponse({ status: 200, description: 'Meal detail returned.' })
  @ApiResponse({ status: 404, description: 'Meal not found.' })
  async getMealById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.mealsService.getMealById(user.id, id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update an existing meal log by ID' })
  @ApiResponse({ status: 200, description: 'Meal successfully updated.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 404, description: 'Meal not found.' })
  async updateMeal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMealDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.mealsService.updateMeal(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a meal log by ID' })
  @ApiResponse({ status: 200, description: 'Meal successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Meal not found.' })
  async deleteMeal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.mealsService.deleteMeal(user.id, id);
  }
}
