import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyRepository } from './taxonomy.repository';
import { TaxonomyService } from './taxonomy.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TaxonomyController],
  providers: [TaxonomyRepository, TaxonomyService],
  exports: [TaxonomyService, TaxonomyRepository],
})
export class TaxonomyModule {}
