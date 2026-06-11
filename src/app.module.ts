import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BodyLabConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DaysModule } from './days/days.module';
import { ExportImportModule } from './export-import/export-import.module';
import { HealthModule } from './health/health.module';
import { LogsModule } from './logs/logs.module';
import { PredictionsModule } from './predictions/predictions.module';
import { PredictionConfigModule } from './prediction-config/prediction-config.module';
import { SyncModule } from './sync/sync.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';

@Module({
  imports: [
    BodyLabConfigModule,
    AuthModule,
    DatabaseModule,
    HealthModule,
    TaxonomyModule,
    SyncModule,
    DaysModule,
    LogsModule,
    PredictionsModule,
    PredictionConfigModule,
    ExportImportModule,
  ],
})
export class AppModule {}
