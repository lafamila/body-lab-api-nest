import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SyncModule } from '../sync/sync.module';
import { DaysController } from './days.controller';
import { DaysRepository } from './days.repository';
import { DaysService } from './days.service';

@Module({
  imports: [AuthModule, DatabaseModule, SyncModule],
  controllers: [DaysController],
  providers: [DaysRepository, DaysService],
})
export class DaysModule {}
