import { Injectable } from '@nestjs/common';
import { SyncService } from '../sync/sync.service';
import { PredictionConfigItemDto, PredictionConfigKind, PredictionConfigStatusDto, UpsertPredictionConfigItemDto } from './dto';
import { PredictionConfigRepository } from './prediction-config.repository';

const REQUIRED_GLOBALS: { key: string; label: string }[] = [
  { key: 'fasting_threshold_hours', label: 'Fasting threshold hours' },
  { key: 'fasting_max_hours', label: 'Fasting max hours' },
  { key: 'fasting_hour_kg', label: 'Fasting kg per hour' },
  { key: 'steps_10000_kg', label: 'Steps kg per 10000' },
  { key: 'delta_min_kg', label: 'Delta min kg' },
  { key: 'delta_max_kg', label: 'Delta max kg' },
];
const REQUIRED_KINDS: Exclude<PredictionConfigKind, 'global'>[] = ['meal', 'drink', 'bathroom', 'workout'];

@Injectable()
export class PredictionConfigService {
  constructor(
    private readonly repository: PredictionConfigRepository,
    private readonly sync: SyncService,
  ) {}

  list(includeInactive = false): Promise<PredictionConfigItemDto[]> {
    return this.repository.list(includeInactive);
  }

  async status(): Promise<PredictionConfigStatusDto> {
    const items = await this.list(false);
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

  async replaceAll(payloads: UpsertPredictionConfigItemDto[]): Promise<PredictionConfigItemDto[]> {
    const items = await this.repository.replaceAll(payloads);
    await this.publishConfig();
    return items;
  }

  private async publishConfig(): Promise<void> {
    await this.sync.publishPredictionConfig(await this.list(false));
  }
}
