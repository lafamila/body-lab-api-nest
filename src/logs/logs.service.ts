import { Injectable } from '@nestjs/common';
import { SyncService } from '../sync/sync.service';
import { LogResource } from './log-resource';
import { LogPayload, LogsRepository, StoredLog } from './logs.repository';

@Injectable()
export class LogsService {
  constructor(
    private readonly repository: LogsRepository,
    private readonly syncService: SyncService,
  ) {}

  list(resource: LogResource, accountId: string, since?: string): Promise<StoredLog[]> {
    return this.repository.list(resource, accountId, since);
  }

  async create(resource: LogResource, accountId: string, payload: LogPayload): Promise<StoredLog> {
    const row = await this.repository.create(resource, accountId, payload);
    await this.syncService.publish(accountId, resource, 'created', row);
    return row;
  }

  async update(resource: LogResource, accountId: string, id: string, payload: LogPayload): Promise<StoredLog> {
    const row = await this.repository.update(resource, accountId, id, payload);
    await this.syncService.publish(accountId, resource, 'updated', row);
    return row;
  }

  async delete(resource: LogResource, accountId: string, id: string): Promise<StoredLog> {
    const row = await this.repository.softDelete(resource, accountId, id);
    await this.syncService.publish(accountId, resource, 'deleted', row);
    return row;
  }
}
