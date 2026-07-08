import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMealsQuery } from './get-meals.query';
import { MealsRepository } from '../repositories/meals.repository';

@QueryHandler(GetMealsQuery)
export class GetMealsHandler implements IQueryHandler<GetMealsQuery> {
  constructor(private readonly mealsRepository: MealsRepository) {}

  async execute(query: GetMealsQuery) {
    const { userId } = query;
    return this.mealsRepository.findByUserId(userId);
  }
}
