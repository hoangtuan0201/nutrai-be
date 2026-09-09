import { Controller, Post, Get, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateMealDto } from './dto/create-meal.dto';
import { CreateMealCommand } from './commands/create-meal.command';
import { GetMealsQuery } from './queries/get-meals.query';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Meals')
@Controller('meals')
export class MealsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Create a new meal log' })
  @ApiResponse({ status: 201, description: 'Meal log successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async createMeal(@Body() dto: CreateMealDto) {
    return this.commandBus.execute(new CreateMealCommand(dto));
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all meal logs of a specific user' })
  @ApiResponse({ status: 200, description: 'List of meal logs returned.' })
  async getMeals(@Param('userId') userId: string) {
    return this.queryBus.execute(new GetMealsQuery(userId));
  }
}
