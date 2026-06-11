import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { LogsModule } from '../logs/logs.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { SyncModule } from '../sync/sync.module';
import { ExportImportController } from './export-import.controller';
import { ExportImportService } from './export-import.service';

@Module({
  imports: [AuthModule, DatabaseModule, LogsModule, PredictionsModule, SyncModule],
  controllers: [ExportImportController],
  providers: [ExportImportService],
})
export class ExportImportModule {}
