import { Injectable } from '@nestjs/common';
import { BodyLabConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';

export interface DaySnapshot {
  date: string;
  contextDates: string[];
  weight: Record<string, unknown> | null;
  meals: Record<string, unknown>[];
  drinks: Record<string, unknown>[];
  bathroom: Record<string, unknown>[];
  manualWorkouts: Record<string, unknown>[];
  healthImports: Record<string, unknown>[];
  predictions: Record<string, unknown>[];
}

export interface UpsertDayPayload {
  morningWeightKg?: number;
  morningWeightMeasuredAt?: string;
}

@Injectable()
export class DaysRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: BodyLabConfigService,
  ) {}

  async getDay(accountId: string, localDate: string): Promise<DaySnapshot> {
    const dailyWeightClientEventId = `daily-weight:${localDate}`;
    const contextDates = this.contextDates(localDate);
    const [weights, meals, drinks, bathroom, manualWorkouts, healthImports, predictions] = await Promise.all([
      this.database.query(
        `
          select *
          from body_weight_logs
          where account_id = $1
            and deleted_at is null
            and (
              client_event_id = $3
              or (measured_at at time zone $4)::date = $2::date
            )
          order by case when client_event_id = $3 then 0 else 1 end, measured_at asc
        `,
        [accountId, localDate, dailyWeightClientEventId, this.config.localTimeZone],
      ),
      this.contextRows('meal_logs', 'occurred_at', accountId, localDate),
      this.contextRows('drink_logs', 'occurred_at', accountId, localDate),
      this.contextRows('bathroom_logs', 'occurred_at', accountId, localDate),
      this.contextRows('manual_workout_logs', 'occurred_at', accountId, localDate),
      this.contextRows('health_import_summaries', 'period_start', accountId, localDate),
      this.database.query(
        `
          select *
          from prediction_snapshots
          where account_id = $1
            and target_date between ($2::date - interval '1 day') and ($2::date + interval '1 day')
            and deleted_at is null
          order by generated_at desc
        `,
        [accountId, localDate],
      ),
    ]);

    return {
      date: localDate,
      contextDates,
      weight: weights.rows[0] ? this.toApi(weights.rows[0]) : null,
      meals: meals.rows.map((row) => this.toApi(row)),
      drinks: drinks.rows.map((row) => this.toApi(row)),
      bathroom: bathroom.rows.map((row) => this.toApi(row)),
      manualWorkouts: manualWorkouts.rows.map((row) => this.toApi(row)),
      healthImports: healthImports.rows.map((row) => this.toApi(row)),
      predictions: predictions.rows.map((row) => this.toApi(row)),
    };
  }

  async upsertDay(accountId: string, localDate: string, payload: UpsertDayPayload): Promise<DaySnapshot> {
    await this.database.transaction(async (query) => {
      if (typeof payload.morningWeightKg !== 'undefined') {
        const measuredAt = payload.morningWeightMeasuredAt ?? `${localDate}T07:00:00.000Z`;
        const clientEventId = `daily-weight:${localDate}`;
        const existingDailyWeight = await query(
          `
            update body_weight_logs
            set measured_at = $2,
                value_kg = $3,
                source = 'manual',
                updated_at = now(),
                deleted_at = null
            where account_id = $1
              and client_event_id = $4
            returning *
          `,
          [accountId, measuredAt, payload.morningWeightKg, clientEventId],
        );
        if (existingDailyWeight.rowCount) {
          return;
        }

        const updated = await query(
          `
            update body_weight_logs
            set measured_at = $4,
                value_kg = $5,
                source = 'manual',
                client_event_id = $6,
                updated_at = now(),
                deleted_at = null
            where account_id = $1
              and (measured_at at time zone $2)::date = $3::date
              and deleted_at is null
            returning *
          `,
          [accountId, this.config.localTimeZone, localDate, measuredAt, payload.morningWeightKg, clientEventId],
        );
        if (!updated.rowCount) {
          await query(
            `
              insert into body_weight_logs (account_id, measured_at, value_kg, source, client_event_id)
              values ($1, $2, $3, 'manual', $4)
            `,
            [accountId, measuredAt, payload.morningWeightKg, clientEventId],
          );
        }
      }
    });

    return this.getDay(accountId, localDate);
  }

  private contextRows(table: string, column: string, accountId: string, localDate: string) {
    return this.database.query(
      `
        select *
        from ${table}
        where account_id = $1
          and (${column} at time zone $3)::date between ($2::date - interval '1 day') and ($2::date + interval '1 day')
          and deleted_at is null
        order by ${column} asc
      `,
      [accountId, localDate, this.config.localTimeZone],
    );
  }

  private contextDates(localDate: string): string[] {
    const [year, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
    const center = new Date(Date.UTC(year, month - 1, day));
    return [-1, 0, 1].map((offset) => {
      const date = new Date(center.getTime());
      date.setUTCDate(center.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    });
  }

  private toApi(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      date: row.local_date,
      measuredAt: row.measured_at,
      valueKg: row.value_kg === undefined ? undefined : Number(row.value_kg),
      occurredAt: row.occurred_at,
      label: row.label,
      size: row.size,
      drinkType: row.drink_type,
      amountMl: row.amount_ml,
      bathroomType: row.bathroom_type,
      durationMinutes: row.duration_minutes,
      intensity: row.intensity,
      sourceType: row.source_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      metric: row.metric,
      targetDate: row.target_date,
      predictedWeightKg: row.predicted_weight_kg === undefined ? undefined : Number(row.predicted_weight_kg),
      note: row.note,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
