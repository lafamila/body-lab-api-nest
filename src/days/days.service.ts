import { Injectable } from '@nestjs/common';
import { SyncService } from '../sync/sync.service';
import { DaysRepository, UpsertDayPayload } from './days.repository';

@Injectable()
export class DaysService {
  constructor(
    private readonly repository: DaysRepository,
    private readonly syncService: SyncService,
  ) {}

  getDay(accountId: string, date: string) {
    return this.repository.getDay(accountId, date);
  }

  async upsertDay(accountId: string, date: string, payload: UpsertDayPayload) {
    const day = await this.repository.upsertDay(accountId, date, payload);
    await this.syncService.publish(accountId, 'days', 'updated', {
      id: date,
      updatedAt: new Date().toISOString(),
    });
    return day;
  }
}
