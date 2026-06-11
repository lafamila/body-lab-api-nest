import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ExportImportModule } from '../export-import/export-import.module';
import { SyncModule } from '../sync/sync.module';
import { PredictionConfigController } from './prediction-config.controller';
import { PredictionConfigRepository } from './prediction-config.repository';
import { PredictionConfigService } from './prediction-config.service';

@Module({
  imports: [AuthModule, DatabaseModule, ExportImportModule, SyncModule],
  controllers: [PredictionConfigController],
  providers: [PredictionConfigRepository, PredictionConfigService],
  exports: [PredictionConfigService],
})
export class PredictionConfigModule {}
