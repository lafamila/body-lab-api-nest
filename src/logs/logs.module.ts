import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SyncModule } from '../sync/sync.module';
import { LogsController } from './logs.controller';
import { LogsRepository } from './logs.repository';
import { LogsService } from './logs.service';

@Module({
  imports: [AuthModule, DatabaseModule, SyncModule],
  controllers: [LogsController],
  providers: [LogsRepository, LogsService],
  exports: [LogsRepository, LogsService],
})
export class LogsModule {}
