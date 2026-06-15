import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PredictionConfigItemDto, UpsertPredictionConfigItemDto } from './dto';

@Injectable()
export class PredictionConfigRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(accountId: string, includeInactive = false): Promise<PredictionConfigItemDto[]> {
    const result = await this.database.query(
      `
        with effective_globals as (
          select
            coalesce(override.id, defaults.id) as id,
            defaults.kind,
            defaults.key,
            coalesce(override.label, defaults.label) as label,
            coalesce(override.mass_kg, defaults.mass_kg) as mass_kg,
            coalesce(override.stool_ratio, defaults.stool_ratio) as stool_ratio,
            coalesce(override.minute_factor, defaults.minute_factor) as minute_factor,
            coalesce(override.sort_order, defaults.sort_order) as sort_order,
            true as is_active,
            coalesce(override.metadata, defaults.metadata) as metadata,
            coalesce(override.updated_at, defaults.updated_at) as updated_at
          from prediction_config_items defaults
          left join prediction_config_items override
            on override.account_id = $2
           and override.kind = 'global'
           and override.key = defaults.key
           and override.deleted_at is null
          where defaults.kind = 'global'
            and defaults.account_id is null
            and defaults.deleted_at is null
        )
        select *
        from effective_globals
        union all
        select id, kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata, updated_at
        from prediction_config_items
        where kind <> 'global'
          and account_id = $2
          and deleted_at is null
          and ($1::boolean = true or is_active = true)
        order by kind asc, sort_order asc, key asc
      `,
      [includeInactive, accountId],
    );
    return result.rows.map((row) => this.toDto(row));
  }

  async upsert(accountId: string, payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    const result = await this.database.query(
      `
        insert into prediction_config_items
          (account_id, kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (account_id, kind, key) where account_id is not null do update set
          label = excluded.label,
          mass_kg = excluded.mass_kg,
          stool_ratio = excluded.stool_ratio,
          minute_factor = excluded.minute_factor,
          sort_order = excluded.sort_order,
          is_active = excluded.is_active,
          metadata = excluded.metadata,
          deleted_at = null,
          updated_at = now()
        returning *
      `,
      [
        accountId,
        payload.kind,
        payload.key,
        payload.label,
        payload.massKg ?? null,
        payload.stoolRatio ?? null,
        payload.minuteFactor ?? null,
        payload.sortOrder ?? 0,
        payload.isActive ?? true,
        JSON.stringify(payload.metadata ?? {}),
      ],
    );
    return this.toDto(result.rows[0]);
  }

  async update(accountId: string, id: string, payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    const existing = await this.findOwned(accountId, id);
    const kind = existing.kind === 'global' ? 'global' : payload.kind;
    const key = existing.kind === 'global' ? existing.key : payload.key;
    const isActive = existing.kind === 'global' ? true : (payload.isActive ?? true);
    if (existing.kind === 'global') {
      const result = await this.database.query(
        `
          insert into prediction_config_items
            (account_id, kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata)
          values ($1, 'global', $2, $3, $4, $5, $6, $7, true, $8)
          on conflict (account_id, kind, key) where account_id is not null do update set
            label = excluded.label,
            mass_kg = excluded.mass_kg,
            stool_ratio = excluded.stool_ratio,
            minute_factor = excluded.minute_factor,
            sort_order = excluded.sort_order,
            is_active = true,
            metadata = excluded.metadata,
            deleted_at = null,
            updated_at = now()
          returning *
        `,
        [
          accountId,
          key,
          payload.label,
          payload.massKg ?? null,
          payload.stoolRatio ?? null,
          payload.minuteFactor ?? null,
          payload.sortOrder ?? 0,
          JSON.stringify(payload.metadata ?? {}),
        ],
      );
      return this.toDto(result.rows[0]);
    }
    const result = await this.database.query(
      `
        update prediction_config_items
        set kind = $3,
            key = $4,
            label = $5,
            mass_kg = $6,
            stool_ratio = $7,
            minute_factor = $8,
            sort_order = $9,
            is_active = $10,
            metadata = $11,
            updated_at = now()
        where id = $1
          and deleted_at is null
          and (
            (kind = 'global' and account_id is null)
            or
            (kind <> 'global' and account_id = $2)
          )
        returning *
      `,
      [
        id,
        accountId,
        kind,
        key,
        payload.label,
        payload.massKg ?? null,
        payload.stoolRatio ?? null,
        payload.minuteFactor ?? null,
        payload.sortOrder ?? 0,
        isActive,
        JSON.stringify(payload.metadata ?? {}),
      ],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Prediction config item not found');
    }
    return this.toDto(result.rows[0]);
  }

  async softDelete(accountId: string, id: string): Promise<PredictionConfigItemDto> {
    const result = await this.database.query(
      `
        update prediction_config_items
        set deleted_at = now(), is_active = false, updated_at = now()
        where id = $1
          and kind <> 'global'
          and account_id = $2
          and deleted_at is null
        returning *
      `,
      [id, accountId],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Prediction config item not found');
    }
    return this.toDto(result.rows[0]);
  }

  async replaceAll(accountId: string, payloads: UpsertPredictionConfigItemDto[]): Promise<PredictionConfigItemDto[]> {
    return this.database.transaction(async (query) => {
      await query(
        `
          update prediction_config_items
          set deleted_at = now(), is_active = false, updated_at = now()
          where account_id = $1 and deleted_at is null
        `,
        [accountId],
      );

      const rows: PredictionConfigItemDto[] = [];
      for (const payload of payloads) {
        const params = [
          accountId,
          payload.kind,
          payload.key,
          payload.label,
          payload.massKg ?? null,
          payload.stoolRatio ?? null,
          payload.minuteFactor ?? null,
          payload.sortOrder ?? 0,
          payload.kind === 'global' ? true : (payload.isActive ?? true),
          JSON.stringify(payload.metadata ?? {}),
        ];
        const result = await query(
          payload.kind === 'global'
            ? `
              insert into prediction_config_items
                (account_id, kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata)
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              on conflict (account_id, kind, key) where account_id is not null do update set
                label = excluded.label,
                mass_kg = excluded.mass_kg,
                stool_ratio = excluded.stool_ratio,
                minute_factor = excluded.minute_factor,
                sort_order = excluded.sort_order,
                is_active = excluded.is_active,
                metadata = excluded.metadata,
                deleted_at = null,
                updated_at = now()
              returning *
            `
            : `
              insert into prediction_config_items
                (account_id, kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata)
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              on conflict (account_id, kind, key) where account_id is not null do update set
                label = excluded.label,
                mass_kg = excluded.mass_kg,
                stool_ratio = excluded.stool_ratio,
                minute_factor = excluded.minute_factor,
                sort_order = excluded.sort_order,
                is_active = excluded.is_active,
                metadata = excluded.metadata,
                deleted_at = null,
                updated_at = now()
              returning *
            `,
          params,
        );
        rows.push(this.toDto(result.rows[0]));
      }
      return rows;
    });
  }

  private async findOwned(accountId: string, id: string): Promise<PredictionConfigItemDto> {
    const result = await this.database.query(
      `
        select *
        from prediction_config_items
        where id = $1
          and deleted_at is null
          and (
            (kind = 'global' and (account_id = $2 or account_id is null))
            or
            (kind <> 'global' and account_id = $2)
          )
      `,
      [id, accountId],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Prediction config item not found');
    }
    return this.toDto(result.rows[0]);
  }

  private toDto(row: Record<string, unknown>): PredictionConfigItemDto {
    return {
      id: String(row.id),
      kind: row.kind as PredictionConfigItemDto['kind'],
      key: String(row.key),
      label: String(row.label),
      massKg: row.mass_kg === null ? null : Number(row.mass_kg),
      stoolRatio: row.stool_ratio === null ? null : Number(row.stool_ratio),
      minuteFactor: row.minute_factor === null ? null : Number(row.minute_factor),
      sortOrder: Number(row.sort_order),
      isActive: Boolean(row.is_active),
      metadata: this.metadataToDto(row.metadata),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  }

  private metadataToDto(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }
}
