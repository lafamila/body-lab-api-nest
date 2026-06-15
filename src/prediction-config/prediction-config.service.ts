import { BadRequestException, Injectable } from '@nestjs/common';
import { SyncService } from '../sync/sync.service';
import { PredictionConfigItemDto, PredictionConfigKind, PredictionConfigStatusDto, UpsertPredictionConfigItemDto } from './dto';
import { PredictionConfigRepository } from './prediction-config.repository';

const REQUIRED_GLOBALS: { key: string; label: string }[] = [
  { key: 'fasting_threshold_hours', label: 'Fasting threshold hours' },
  { key: 'fasting_hour_kg', label: 'Fasting kg per hour' },
  { key: 'steps_10000_kg', label: 'Steps kg per 10000' },
  { key: 'daily_base_delta_kg', label: 'Daily base delta kg' },
];
const REQUIRED_KINDS: Exclude<PredictionConfigKind, 'global'>[] = ['meal', 'drink', 'bathroom', 'workout'];

@Injectable()
export class PredictionConfigService {
  constructor(
    private readonly repository: PredictionConfigRepository,
    private readonly sync: SyncService,
  ) {}

  list(accountId: string, includeInactive = false): Promise<PredictionConfigItemDto[]> {
    return this.repository.list(accountId, includeInactive);
  }

  async status(accountId: string): Promise<PredictionConfigStatusDto> {
    const items = await this.list(accountId, false);
    const activeByGlobalKey = new Map(
      items.filter((item) => item.kind === 'global' && item.isActive).map((item) => [item.key, item]),
    );
    const requiredGlobals = REQUIRED_GLOBALS.map((requirement) => {
      const item = activeByGlobalKey.get(requirement.key) ?? null;
      return {
        ...requirement,
        present: Boolean(item),
        item,
      };
    });
    const requiredKinds = REQUIRED_KINDS.map((kind) => {
      const activeCount = items.filter((item) => item.kind === kind && item.isActive).length;
      return {
        kind,
        minActive: 1,
        activeCount,
        present: activeCount >= 1,
      };
    });
    const missingGlobalKeys = requiredGlobals.filter((requirement) => !requirement.present).map((requirement) => requirement.key);
    const missingKinds = requiredKinds.filter((requirement) => !requirement.present).map((requirement) => requirement.kind);
    const isReady = missingGlobalKeys.length === 0 && missingKinds.length === 0;
    return {
      isReady,
      requiresSetup: !isReady,
      missingGlobalKeys,
      missingKinds,
      requiredGlobals,
      requiredKinds,
      checkedAt: new Date().toISOString(),
    };
  }

  async upsert(accountId: string, payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    if (payload.kind === 'global') {
      throw new BadRequestException('Global prediction config keys cannot be created');
    }
    const item = await this.repository.upsert(accountId, payload);
    await this.publishConfig(accountId);
    return item;
  }

  async update(accountId: string, id: string, payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    const item = await this.repository.update(accountId, id, payload);
    await this.publishConfig(accountId);
    return item;
  }

  async delete(accountId: string, id: string): Promise<PredictionConfigItemDto> {
    const item = await this.repository.softDelete(accountId, id);
    await this.publishConfig(accountId);
    return item;
  }

  async replaceAll(accountId: string, payloads: UpsertPredictionConfigItemDto[]): Promise<PredictionConfigItemDto[]> {
    const items = await this.repository.replaceAll(accountId, payloads);
    await this.publishConfig(accountId);
    return items;
  }

  private async publishConfig(accountId: string): Promise<void> {
    await this.sync.publishPredictionConfig(accountId, await this.list(accountId, false));
  }
}
