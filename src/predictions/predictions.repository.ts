import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type PredictionPayload = object;
export type PredictionSnapshot = Record<string, unknown>;

const COLUMNS: Record<string, string> = {
  targetDate: 'target_date',
  generatedAt: 'generated_at',
  modelVersion: 'model_version',
  predictedWeightKg: 'predicted_weight_kg',
  actualWeightKg: 'actual_weight_kg',
  explanation: 'explanation',
  inputSummary: 'input_summary',
  clientSnapshotId: 'client_snapshot_id',
};

const JSON_COLUMNS = new Set(['explanation', 'inputSummary']);

@Injectable()
export class PredictionsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(accountId: string, since?: string): Promise<PredictionSnapshot[]> {
    const params: unknown[] = [accountId];
    const where = ['account_id = $1', 'deleted_at is null'];
    if (since) {
      params.push(since);
      where.push(`updated_at > $${params.length}`);
    }
    const result = await this.database.query(
      `
        select *
        from prediction_snapshots
        where ${where.join(' and ')}
        order by target_date desc, generated_at desc
      `,
      params,
    );
    return result.rows.map((row) => this.toApi(row));
  }

  async create(accountId: string, payload: PredictionPayload): Promise<PredictionSnapshot> {
    return this.createWithQuery(this.database.query.bind(this.database), accountId, payload);
  }

  async update(accountId: string, id: string, payload: PredictionPayload): Promise<PredictionSnapshot> {
    const entries = this.entriesForPayload(payload, false);
    if (!entries.length) {
      return this.get(accountId, id);
    }
    const assignments = entries.map(([column], index) => `${column} = $${index + 3}`);
    const params = [accountId, id, ...entries.map(([, value]) => value)];
    const result = await this.database.query(
      `
        update prediction_snapshots
        set ${assignments.join(', ')}, updated_at = now()
        where account_id = $1 and id = $2 and deleted_at is null
        returning *
      `,
      params,
    );
    if (!result.rowCount) {
      throw new NotFoundException('prediction snapshot not found');
    }
    return this.toApi(result.rows[0]);
  }

  async softDelete(accountId: string, id: string): Promise<PredictionSnapshot> {
    const result = await this.database.query(
      `
        update prediction_snapshots
        set deleted_at = now(), updated_at = now()
        where account_id = $1 and id = $2 and deleted_at is null
        returning *
      `,
      [accountId, id],
    );
    if (!result.rowCount) {
      throw new NotFoundException('prediction snapshot not found');
    }
    return this.toApi(result.rows[0]);
  }

  async replaceAll(accountId: string, payloads: PredictionPayload[]): Promise<PredictionSnapshot[]> {
    return this.database.transaction(async (query) => {
      await query('delete from prediction_snapshots where account_id = $1', [accountId]);
      const rows: PredictionSnapshot[] = [];
      for (const payload of payloads) {
        rows.push(await this.createWithQuery(query, accountId, payload));
      }
      return rows;
    });
  }

  private async get(accountId: string, id: string): Promise<PredictionSnapshot> {
    const result = await this.database.query(
      'select * from prediction_snapshots where account_id = $1 and id = $2 and deleted_at is null',
      [accountId, id],
    );
    if (!result.rowCount) {
      throw new NotFoundException('prediction snapshot not found');
    }
    return this.toApi(result.rows[0]);
  }

  private async createWithQuery(
    query: DatabaseService['query'],
    accountId: string,
    payload: PredictionPayload,
  ): Promise<PredictionSnapshot> {
    const entries = this.entriesForPayload(payload, true);
    const columns = ['account_id', ...entries.map(([column]) => column)];
    const params = [accountId, ...entries.map(([, value]) => value)];
    const placeholders = params.map((_value, index) => `$${index + 1}`);
    const result = await query(
      `
        insert into prediction_snapshots (${columns.join(', ')})
        values (${placeholders.join(', ')})
        returning *
      `,
      params,
    );
    return this.toApi(result.rows[0]);
  }

  private entriesForPayload(payload: PredictionPayload, includeClientId: boolean): [string, unknown][] {
    const record = payload as Record<string, unknown>;
    const entries: [string, unknown][] = [];
    for (const [apiKey, column] of Object.entries(COLUMNS)) {
      if (apiKey === 'clientSnapshotId' && !includeClientId) {
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(record, apiKey)) {
        continue;
      }
      const value = record[apiKey];
      if (typeof value === 'undefined') {
        continue;
      }
      entries.push([column, JSON_COLUMNS.has(apiKey) ? JSON.stringify(value ?? {}) : value]);
    }
    return entries;
  }

  private toApi(row: Record<string, unknown>): PredictionSnapshot {
    return {
      id: row.id,
      targetDate: row.target_date,
      generatedAt: row.generated_at,
      modelVersion: row.model_version,
      predictedWeightKg: Number(row.predicted_weight_kg),
      actualWeightKg: row.actual_weight_kg === null ? null : Number(row.actual_weight_kg),
      explanation: row.explanation,
      inputSummary: row.input_summary,
      clientSnapshotId: row.client_snapshot_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
