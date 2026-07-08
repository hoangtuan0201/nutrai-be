import { Controller, Post, Get, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateMealDto } from './dto/create-meal.dto';
import { CreateMealCommand } from './commands/create-meal.command';
import { GetMealsQuery } from './queries/get-meals.query';

@Controller('meals')
export class MealsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createMeal(@Body() dto: CreateMealDto) {
    return this.commandBus.execute(new CreateMealCommand(dto));
  }

  @Get('user/:userId')
  async getMeals(@Param('userId') userId: string) {
    return this.queryBus.execute(new GetMealsQuery(userId));
  }
}
