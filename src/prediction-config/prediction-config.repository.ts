import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PredictionConfigItemDto, UpsertPredictionConfigItemDto } from './dto';

@Injectable()
export class PredictionConfigRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(includeInactive = false): Promise<PredictionConfigItemDto[]> {
    const result = await this.database.query(
      `
        select *
        from prediction_config_items
        where deleted_at is null and ($1::boolean = true or is_active = true)
        order by kind asc, sort_order asc, key asc
      `,
      [includeInactive],
    );
    return result.rows.map(this.toDto);
  }

  async upsert(payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    const result = await this.database.query(
      `
        insert into prediction_config_items
          (kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (kind, key) do update set
          label = excluded.label,
          mass_kg = excluded.mass_kg,
          stool_ratio = excluded.stool_ratio,
          minute_factor = excluded.minute_factor,
          sort_order = excluded.sort_order,
          is_active = excluded.is_active,
          deleted_at = null,
          updated_at = now()
        returning *
      `,
      [
        payload.kind,
        payload.key,
        payload.label,
        payload.massKg ?? null,
        payload.stoolRatio ?? null,
        payload.minuteFactor ?? null,
        payload.sortOrder ?? 0,
        payload.isActive ?? true,
      ],
    );
    return this.toDto(result.rows[0]);
  }

  async update(id: string, payload: UpsertPredictionConfigItemDto): Promise<PredictionConfigItemDto> {
    const result = await this.database.query(
      `
        update prediction_config_items
        set kind = $2,
            key = $3,
            label = $4,
            mass_kg = $5,
            stool_ratio = $6,
            minute_factor = $7,
            sort_order = $8,
            is_active = $9,
            updated_at = now()
        where id = $1 and deleted_at is null
        returning *
      `,
      [
        id,
        payload.kind,
        payload.key,
        payload.label,
        payload.massKg ?? null,
        payload.stoolRatio ?? null,
        payload.minuteFactor ?? null,
        payload.sortOrder ?? 0,
        payload.isActive ?? true,
      ],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Prediction config item not found');
    }
    return this.toDto(result.rows[0]);
  }

  async softDelete(id: string): Promise<PredictionConfigItemDto> {
    const result = await this.database.query(
      `
        update prediction_config_items
        set deleted_at = now(), is_active = false, updated_at = now()
        where id = $1 and deleted_at is null
        returning *
      `,
      [id],
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
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  }
}
