import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface DaySnapshot {
  date: string;
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
  constructor(private readonly database: DatabaseService) {}

  async getDay(accountId: string, localDate: string): Promise<DaySnapshot> {
    const [start, end] = this.bounds(localDate);
    const [weights, meals, drinks, bathroom, manualWorkouts, healthImports, predictions] = await Promise.all([
      this.database.query(
        `
          select *
          from body_weight_logs
          where account_id = $1 and measured_at >= $2 and measured_at < $3 and deleted_at is null
          order by measured_at asc
        `,
        [accountId, start, end],
      ),
      this.dayRows('meal_logs', 'occurred_at', accountId, start, end),
      this.dayRows('drink_logs', 'occurred_at', accountId, start, end),
      this.dayRows('bathroom_logs', 'occurred_at', accountId, start, end),
      this.dayRows('manual_workout_logs', 'occurred_at', accountId, start, end),
      this.dayRows('health_import_summaries', 'period_start', accountId, start, end),
      this.database.query(
        `
          select *
          from prediction_snapshots
          where account_id = $1 and target_date = $2 and deleted_at is null
          order by generated_at desc
        `,
        [accountId, localDate],
      ),
    ]);

    return {
      date: localDate,
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
        const [start, end] = this.bounds(localDate);
        const updated = await query(
          `
            update body_weight_logs
            set measured_at = $4,
                value_kg = $5,
                source = 'manual',
                client_event_id = coalesce(client_event_id, $6),
                updated_at = now(),
                deleted_at = null
            where account_id = $1
              and measured_at >= $2
              and measured_at < $3
              and deleted_at is null
            returning *
          `,
          [accountId, start, end, measuredAt, payload.morningWeightKg, `daily-weight:${localDate}`],
        );
        if (!updated.rowCount) {
          await query(
            `
              insert into body_weight_logs (account_id, measured_at, value_kg, source, client_event_id)
              values ($1, $2, $3, 'manual', $4)
            `,
            [accountId, measuredAt, payload.morningWeightKg, `daily-weight:${localDate}`],
          );
        }
      }
    });

    return this.getDay(accountId, localDate);
  }

  private bounds(localDate: string): [string, string] {
    const start = new Date(`${localDate}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return [start.toISOString(), end.toISOString()];
  }

  private dayRows(table: string, column: string, accountId: string, start: string, end: string) {
    return this.database.query(
      `
        select *
        from ${table}
        where account_id = $1 and ${column} >= $2 and ${column} < $3 and deleted_at is null
        order by ${column} asc
      `,
      [accountId, start, end],
    );
  }

  private toApi(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      date: row.local_date,
      measuredAt: row.measured_at,
      valueKg: row.value_kg === undefined ? undefined : Number(row.value_kg),
      occurredAt: row.occurred_at,
      drinkType: row.drink_type,
      amountMl: row.amount_ml,
      bathroomType: row.bathroom_type,
      durationMinutes: row.duration_minutes,
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
