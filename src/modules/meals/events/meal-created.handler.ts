import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { MealCreatedEvent } from './meal-created.event';
import { Logger } from '@nestjs/common';

@EventsHandler(MealCreatedEvent)
export class MealCreatedHandler implements IEventHandler<MealCreatedEvent> {
  private readonly logger = new Logger(MealCreatedHandler.name);

  handle(event: MealCreatedEvent) {
    this.logger.log(
      `Event received: MealCreatedEvent - Meal ID: ${event.mealId}, User ID: ${event.userId}, Calories: ${event.calories}`,
    );
  }
}
