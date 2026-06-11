import { BadRequestException, Injectable } from '@nestjs/common';
import { LogResource } from '../logs/log-resource';
import { LogsRepository } from '../logs/logs.repository';
import { PredictionsRepository } from '../predictions/predictions.repository';
import { SyncService } from '../sync/sync.service';

const SCHEMA_VERSION = 1;
const LOG_RESOURCES: LogResource[] = ['weights', 'meals', 'drinks', 'health-imports', 'manual-workouts', 'bathroom'];

export interface BodyLabExport {
  schemaVersion: 1;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

@Injectable()
export class ExportImportService {
  constructor(
    private readonly logsRepository: LogsRepository,
    private readonly predictionsRepository: PredictionsRepository,
    private readonly syncService: SyncService,
  ) {}

  async export(accountId: string): Promise<BodyLabExport> {
    const data: Record<string, unknown[]> = {};
    for (const resource of LOG_RESOURCES) {
      data[resource] = await this.logsRepository.list(resource, accountId);
    }
    data.predictions = await this.predictionsRepository.list(accountId);

    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  }

  async import(accountId: string, payload: { schemaVersion: number; data: Record<string, unknown> }) {
    if (payload.schemaVersion !== SCHEMA_VERSION) {
      throw new BadRequestException(`Unsupported body-lab export schemaVersion ${payload.schemaVersion}`);
    }

    this.assertNoAccountLeakage(payload.data);

    const result: Record<string, number> = {};
    for (const resource of LOG_RESOURCES) {
      const rows = this.asArray(payload.data[resource], resource);
      result[resource] = (await this.logsRepository.replaceAll(resource, accountId, rows)).length;
    }

    const predictions = this.asArray(payload.data.predictions, 'predictions');
    result.predictions = (await this.predictionsRepository.replaceAll(accountId, predictions)).length;

    await this.syncService.publish(accountId, 'export-import', 'imported', {
      id: 'import',
      updatedAt: new Date().toISOString(),
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      importedAt: new Date().toISOString(),
      imported: result,
    };
  }

  private asArray(value: unknown, name: string): Record<string, unknown>[] {
    if (typeof value === 'undefined') {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${name} must be an array`);
    }
    return value.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new BadRequestException(`${name}[${index}] must be an object`);
      }
      const record = { ...(entry as Record<string, unknown>) };
      delete record.id;
      delete record.createdAt;
      delete record.updatedAt;
      return record;
    });
  }

  private assertNoAccountLeakage(value: unknown): void {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('data must be an object');
    }
    const stack: unknown[] = [value];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') {
        continue;
      }
      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }
      const record = current as Record<string, unknown>;
      if ('accountId' in record || 'account_id' in record) {
        throw new BadRequestException('Import payload must not contain account ownership fields');
      }
      stack.push(...Object.values(record));
    }
  }
}
