import { Injectable } from '@nestjs/common';
import { TaxonomyCategory, TaxonomyRepository } from './taxonomy.repository';

@Injectable()
export class TaxonomyService {
  constructor(private readonly repository: TaxonomyRepository) {}

  list(kind?: 'meal' | 'exercise'): Promise<TaxonomyCategory[]> {
    return this.repository.list(kind);
  }
}
