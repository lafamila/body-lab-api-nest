import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LOG_TABLES, LogResource, LogTableConfig } from './log-resource';

export type LogPayload = object;
export type StoredLog = Record<string, unknown>;

@Injectable()
export class LogsRepository {
  constructor(private readonly database: DatabaseService) {}

  list(resource: LogResource, accountId: string, since?: string): Promise<StoredLog[]> {
    return this.listWithQuery(this.database.query.bind(this.database), resource, accountId, since);
  }

  async create(resource: LogResource, accountId: string, payload: LogPayload): Promise<StoredLog> {
    return this.createWithQuery(this.database.query.bind(this.database), resource, accountId, payload);
  }

  async update(resource: LogResource, accountId: string, id: string, payload: LogPayload): Promise<StoredLog> {
    const config = LOG_TABLES[resource];
    const updates = this.entriesForPayload(config, payload, false);
    if (updates.length === 0) {
      return this.get(resource, accountId, id);
    }

    const assignments = updates.map(([column], index) => `${column} = $${index + 3}`);
    const params = [accountId, id, ...updates.map(([, value]) => value)];
    const result = await this.database.query(
      `
        update ${config.table}
        set ${assignments.join(', ')}, updated_at = now()
        where account_id = $1 and id = $2 and deleted_at is null
        returning *
      `,
      params,
    );
    if (!result.rowCount) {
      throw new NotFoundException(`${resource} log not found`);
    }
    return this.toApi(result.rows[0]);
  }

  async softDelete(resource: LogResource, accountId: string, id: string): Promise<StoredLog> {
    const config = LOG_TABLES[resource];
    const result = await this.database.query(
      `
        update ${config.table}
        set deleted_at = now(), updated_at = now()
        where account_id = $1 and id = $2 and deleted_at is null
        returning *
      `,
      [accountId, id],
    );
    if (!result.rowCount) {
      throw new NotFoundException(`${resource} log not found`);
    }
    return this.toApi(result.rows[0]);
  }

  async replaceAll(resource: LogResource, accountId: string, payloads: LogPayload[]): Promise<StoredLog[]> {
    return this.database.transaction(async (query) => {
      const config = LOG_TABLES[resource];
      await query(`delete from ${config.table} where account_id = $1`, [accountId]);
      const rows: StoredLog[] = [];
      for (const payload of payloads) {
        rows.push(await this.createWithQuery(query, resource, accountId, payload));
      }
      return rows;
    });
  }

  async get(resource: LogResource, accountId: string, id: string): Promise<StoredLog> {
    const config = LOG_TABLES[resource];
    const result = await this.database.query(
      `select * from ${config.table} where account_id = $1 and id = $2 and deleted_at is null`,
      [accountId, id],
    );
    if (!result.rowCount) {
      throw new NotFoundException(`${resource} log not found`);
    }
    return this.toApi(result.rows[0]);
  }

  private async listWithQuery(
    query: DatabaseService['query'],
    resource: LogResource,
    accountId: string,
    since?: string,
  ): Promise<StoredLog[]> {
    const config = LOG_TABLES[resource];
    const params: unknown[] = [accountId];
    const where = ['account_id = $1', 'deleted_at is null'];
    if (since) {
      params.push(since);
      where.push(`updated_at > $${params.length}`);
    }
    const result = await query(
      `
        select *
        from ${config.table}
        where ${where.join(' and ')}
        order by updated_at asc, id asc
      `,
      params,
    );
    return result.rows.map((row) => this.toApi(row));
  }

  private async createWithQuery(
    query: DatabaseService['query'],
    resource: LogResource,
    accountId: string,
    payload: LogPayload,
  ): Promise<StoredLog> {
    if (resource === 'health-imports') {
      const existing = await this.updateExistingHealthImportForDate(query, accountId, payload);
      if (existing) {
        return existing;
      }
    }

    const config = LOG_TABLES[resource];
    const entries = this.entriesForPayload(config, payload, true);
    const columns = ['account_id', ...entries.map(([column]) => column)];
    const params = [accountId, ...entries.map(([, value]) => value)];
    const placeholders = params.map((_value, index) => `$${index + 1}`);
    const result = await query(
      `
        insert into ${config.table} (${columns.join(', ')})
        values (${placeholders.join(', ')})
        returning *
      `,
      params,
    );
    return this.toApi(result.rows[0]);
  }

  private async updateExistingHealthImportForDate(
    query: DatabaseService['query'],
    accountId: string,
    payload: LogPayload,
  ): Promise<StoredLog | null> {
    const record = payload as Record<string, unknown>;
    if (!record.periodStart || !record.periodEnd || !record.sourceType || typeof record.metric === 'undefined') {
      return null;
    }

    const [start, end] = this.utcDayBounds(String(record.periodStart));
    const hasExternalId = Object.prototype.hasOwnProperty.call(record, 'externalId');
    const hasMetadata = Object.prototype.hasOwnProperty.call(record, 'metadata');
    const hasClientEventId = Object.prototype.hasOwnProperty.call(record, 'clientEventId');
    const result = await query(
      `
        update health_import_summaries
        set period_start = $5,
            period_end = $6,
            external_id = case when $7::boolean then $8 else external_id end,
            metric = $9::jsonb,
            metadata = case when $10::boolean then $11::jsonb else metadata end,
            client_event_id = case when $12::boolean then $13 else client_event_id end,
            updated_at = now(),
            deleted_at = null
        where id = (
          select id
          from health_import_summaries
          where account_id = $1
            and period_start >= $2
            and period_start < $3
            and source_type = $4
            and deleted_at is null
          order by updated_at desc, id desc
          limit 1
        )
        returning *
      `,
      [
        accountId,
        start,
        end,
        record.sourceType,
        record.periodStart,
        record.periodEnd,
        hasExternalId,
        hasExternalId ? record.externalId : null,
        JSON.stringify(record.metric ?? {}),
        hasMetadata,
        JSON.stringify(record.metadata ?? {}),
        hasClientEventId,
        hasClientEventId ? record.clientEventId : null,
      ],
    );
    if (!result.rowCount) {
      return null;
    }

    await query(
      `
        update health_import_summaries
        set deleted_at = now(), updated_at = now()
        where account_id = $1
          and period_start >= $2
          and period_start < $3
          and source_type = $4
          and deleted_at is null
          and id <> $5
      `,
      [accountId, start, end, record.sourceType, result.rows[0].id],
    );
    return this.toApi(result.rows[0]);
  }

  private utcDayBounds(isoDate: string): [string, string] {
    const measuredAt = new Date(isoDate);
    const start = new Date(Date.UTC(measuredAt.getUTCFullYear(), measuredAt.getUTCMonth(), measuredAt.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return [start.toISOString(), end.toISOString()];
  }

  private entriesForPayload(config: LogTableConfig, payload: LogPayload, includeClientId: boolean): [string, unknown][] {
    const record = payload as Record<string, unknown>;
    const entries: [string, unknown][] = [];
    for (const [apiKey, column] of Object.entries(config.columns)) {
      if (apiKey === 'clientEventId' && !includeClientId) {
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(record, apiKey)) {
        continue;
      }
      const value = record[apiKey];
      if (typeof value === 'undefined') {
        continue;
      }
      entries.push([column, config.jsonColumns?.has(apiKey) ? JSON.stringify(value ?? {}) : value]);
    }
    return entries;
  }

  private toApi(row: Record<string, unknown>): StoredLog {
    return {
      id: row.id,
      measuredAt: row.measured_at,
      valueKg: row.value_kg === undefined ? undefined : Number(row.value_kg),
      occurredAt: row.occurred_at,
      mealCategoryId: row.meal_category_id,
      label: row.label,
      size: row.size,
      drinkType: row.drink_type,
      amountMl: row.amount_ml,
      caffeineMg: row.caffeine_mg,
      sourceType: row.source_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      externalId: row.external_id,
      metric: row.metric,
      exerciseCategoryId: row.exercise_category_id,
      durationMinutes: row.duration_minutes,
      intensity: row.intensity,
      calories: row.calories,
      bathroomType: row.bathroom_type,
      source: row.source,
      note: row.note,
      notes: row.notes,
      metadata: row.metadata,
      clientEventId: row.client_event_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
