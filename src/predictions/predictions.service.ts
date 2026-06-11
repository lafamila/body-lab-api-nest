import { Injectable } from '@nestjs/common';
import { SyncService } from '../sync/sync.service';
import { PredictionPayload, PredictionsRepository, PredictionSnapshot } from './predictions.repository';

@Injectable()
export class PredictionsService {
  constructor(
    private readonly repository: PredictionsRepository,
    private readonly syncService: SyncService,
  ) {}

  list(accountId: string, since?: string): Promise<PredictionSnapshot[]> {
    return this.repository.list(accountId, since);
  }

  async create(accountId: string, payload: PredictionPayload): Promise<PredictionSnapshot> {
    const row = await this.repository.create(accountId, payload);
    await this.syncService.publish(accountId, 'predictions', 'created', row);
    return row;
  }

  async update(accountId: string, id: string, payload: PredictionPayload): Promise<PredictionSnapshot> {
    const row = await this.repository.update(accountId, id, payload);
    await this.syncService.publish(accountId, 'predictions', 'updated', row);
    return row;
  }

  async delete(accountId: string, id: string): Promise<PredictionSnapshot> {
    const row = await this.repository.softDelete(accountId, id);
    await this.syncService.publish(accountId, 'predictions', 'deleted', row);
    return row;
  }
}
