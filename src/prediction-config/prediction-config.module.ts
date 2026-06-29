import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ExportImportModule } from '../export-import/export-import.module';
import { SyncModule } from '../sync/sync.module';
import { PredictionConfigController } from './prediction-config.controller';
import { PredictionCalibrationRepository } from './prediction-calibration.repository';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionConfigRepository } from './prediction-config.repository';
import { PredictionConfigService } from './prediction-config.service';

@Module({
  imports: [AuthModule, DatabaseModule, ExportImportModule, SyncModule],
  controllers: [PredictionConfigController],
  providers: [PredictionCalibrationRepository, PredictionCalibrationService, PredictionConfigRepository, PredictionConfigService],
  exports: [PredictionConfigService],
})
export class PredictionConfigModule {}
