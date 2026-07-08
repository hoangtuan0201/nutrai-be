import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { CreateMealCommand } from './create-meal.command';
import { MealsRepository } from '../repositories/meals.repository';
import { MealCreatedEvent } from '../events/meal-created.event';

@CommandHandler(CreateMealCommand)
export class CreateMealHandler implements ICommandHandler<CreateMealCommand> {
  constructor(
    private readonly mealsRepository: MealsRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateMealCommand) {
    const { dto } = command;
    
    // Save to database using Repository
    const mealLog = await this.mealsRepository.create(dto);

    // Publish event
    this.eventBus.publish(new MealCreatedEvent(mealLog.id, mealLog.userId, mealLog.calories));

    return mealLog;
  }
}
