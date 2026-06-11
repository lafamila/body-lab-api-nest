import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TaxonomyService } from './taxonomy.service';

@UseGuards(JwtAuthGuard)
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get()
  list(@Query('kind') kind?: 'meal' | 'exercise') {
    return this.taxonomyService.list(kind);
  }
}
