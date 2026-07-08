import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MealsController } from './meals.controller';
import { CreateMealHandler } from './commands/create-meal.handler';
import { GetMealsHandler } from './queries/get-meals.handler';
import { MealCreatedHandler } from './events/meal-created.handler';
import { MealsRepository } from './repositories/meals.repository';

const CommandHandlers = [CreateMealHandler];
const QueryHandlers = [GetMealsHandler];
const EventHandlers = [MealCreatedHandler];

@Module({
  imports: [CqrsModule],
  controllers: [MealsController],
  providers: [
    MealsRepository,
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
  ],
  exports: [MealsRepository],
})
export class MealsModule {}
