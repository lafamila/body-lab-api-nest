import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BodyLabSessionGuard } from '../auth/body-lab-session.guard';
import { TaxonomyService } from './taxonomy.service';

@UseGuards(BodyLabSessionGuard)
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get()
  list(@Query('kind') kind?: 'meal' | 'exercise') {
    return this.taxonomyService.list(kind);
  }
}
