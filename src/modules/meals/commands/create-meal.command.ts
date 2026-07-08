import { CreateMealDto } from '../dto/create-meal.dto';

export class CreateMealCommand {
  constructor(public readonly dto: CreateMealDto) {}
}
