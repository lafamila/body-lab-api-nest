import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SyncModule } from '../sync/sync.module';
import { PredictionsController } from './predictions.controller';
import { PredictionsRepository } from './predictions.repository';
import { PredictionsService } from './predictions.service';

@Module({
  imports: [AuthModule, DatabaseModule, SyncModule],
  controllers: [PredictionsController],
  providers: [PredictionsRepository, PredictionsService],
  exports: [PredictionsRepository, PredictionsService],
})
export class PredictionsModule {}
