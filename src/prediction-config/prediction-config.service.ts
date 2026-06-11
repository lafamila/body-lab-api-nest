import { Injectable } from '@nestjs/common';
import { SyncService } from '../sync/sync.service';
import { PredictionConfigItemDto, UpsertPredictionConfigItemDto } from './dto';
import { PredictionConfigRepository } from './prediction-config.repository';

@Injectable()
export class PredictionConfigService {
  constructor(
    private readonly repository: PredictionConfigRepository,
    private readonly sync: SyncService,
  ) {}

  list(includeInactive = false): Promise<PredictionConfigItemDto[]> {
    return this.repository.list(includeInactive);
  }

  async upsert(payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    const item = await this.repository.upsert(payload);
    await this.publishConfig();
    return item;
  }

  async update(id: string, payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    const item = await this.repository.update(id, payload);
    await this.publishConfig();
    return item;
  }

  async delete(id: string): Promise<PredictionConfigItemDto> {
    const item = await this.repository.softDelete(id);
    await this.publishConfig();
    return item;
  }

  private async publishConfig(): Promise<void> {
    await this.sync.publishPredictionConfig(await this.list(false));
  }
}
