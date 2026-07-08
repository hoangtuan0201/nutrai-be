export class MealCreatedEvent {
  constructor(
    public readonly mealId: string,
    public readonly userId: string,
    public readonly calories: number,
  ) {}
}
