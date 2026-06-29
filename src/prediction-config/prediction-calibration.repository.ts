import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PredictionConfigKind } from './dto';

export type CalibrationPatch = {
  kind: PredictionConfigKind;
  key: string;
  field: 'massKg' | 'stoolRatio' | 'minuteFactor';
  oldValue: number;
  proposedValue: number;
  sensitivity: number;
};

export type CalibrationResult = {
  id: string;
  applied: boolean;
  reason?: string;
  appliedPatches: CalibrationPatch[];
};

@Injectable()
export class PredictionCalibrationRepository {
  constructor(private readonly database: DatabaseService) {}

  async applyCalibration(
    accountId: string,
    payload: {
      previousWeightId: string;
      newWeightId: string;
      predictedWeightKg: number;
      actualWeightKg: number;
      residualKg: number;
      proposedPatches: CalibrationPatch[];
    },
  ): Promise<CalibrationResult> {
    return this.database.transaction(async (query) => {
      const weights = await query(
        `
          select id
          from body_weight_logs
          where account_id = $1
            and deleted_at is null
            and id in ($2, $3)
        `,
        [accountId, payload.previousWeightId, payload.newWeightId],
      );
      if (weights.rowCount !== 2) {
        return this.insertEvent(query, accountId, payload, [], 'skipped', 'weight_not_found');
      }

      const existing = await query(
        `
          select id, status, reason, applied_patches
          from prediction_calibration_events
          where account_id = $1 and new_weight_id = $2
        `,
        [accountId, payload.newWeightId],
      );
      if (existing.rowCount) {
        const row = existing.rows[0];
        return {
          id: String(row.id),
          applied: row.status === 'applied',
          reason: row.reason ? String(row.reason) : 'duplicate',
          appliedPatches: this.parsePatches(row.applied_patches),
        };
      }

      const appliedPatches = await this.applyPatches(query, accountId, payload.proposedPatches);
      const status = appliedPatches.length > 0 ? 'applied' : 'skipped';
      const reason = appliedPatches.length > 0 ? undefined : 'no_applicable_patches';
      return this.insertEvent(query, accountId, payload, appliedPatches, status, reason);
    });
  }

  private async applyPatches(
    query: DatabaseService['query'],
    accountId: string,
    patches: CalibrationPatch[],
  ): Promise<CalibrationPatch[]> {
    const applied: CalibrationPatch[] = [];
    for (const patch of patches) {
      const defaultResult = await query(
        `
          select *
          from prediction_config_items
          where account_id is null
            and kind = $1
            and key = $2
            and deleted_at is null
          limit 1
        `,
        [patch.kind, patch.key],
      );
      const ownedResult = await query(
        `
          select *
          from prediction_config_items
          where account_id = $1
            and kind = $2
            and key = $3
            and deleted_at is null
          limit 1
        `,
        [accountId, patch.kind, patch.key],
      );
      const base = ownedResult.rows[0] ?? defaultResult.rows[0];
      if (!base) {
        continue;
      }
      const label = String(base.label);
      const sortOrder = Number(base.sort_order ?? 0);
      const metadata = base.metadata ?? {};
      const massKg = this.fieldValue(patch.field === 'massKg' ? patch.proposedValue : base.mass_kg);
      const stoolRatio = this.fieldValue(patch.field === 'stoolRatio' ? patch.proposedValue : base.stool_ratio);
      const minuteFactor = this.fieldValue(patch.field === 'minuteFactor' ? patch.proposedValue : base.minute_factor);
      await query(
        `
          insert into prediction_config_items
            (account_id, kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata)
          values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
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
        `,
        [
          accountId,
          patch.kind,
          patch.key,
          label,
          massKg,
          stoolRatio,
          minuteFactor,
          sortOrder,
          JSON.stringify(metadata),
        ],
      );
      applied.push(patch);
    }
    return applied;
  }

  private async insertEvent(
    query: DatabaseService['query'],
    accountId: string,
    payload: {
      previousWeightId: string;
      newWeightId: string;
      predictedWeightKg: number;
      actualWeightKg: number;
      residualKg: number;
      proposedPatches: CalibrationPatch[];
    },
    appliedPatches: CalibrationPatch[],
    status: 'applied' | 'skipped',
    reason?: string,
  ): Promise<CalibrationResult> {
    const result = await query(
      `
        insert into prediction_calibration_events
          (account_id, previous_weight_id, new_weight_id, predicted_weight_kg, actual_weight_kg, residual_kg, proposed_patches, applied_patches, status, reason)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id
      `,
      [
        accountId,
        payload.previousWeightId,
        payload.newWeightId,
        payload.predictedWeightKg,
        payload.actualWeightKg,
        payload.residualKg,
        JSON.stringify(payload.proposedPatches),
        JSON.stringify(appliedPatches),
        status,
        reason ?? null,
      ],
    );
    return {
      id: String(result.rows[0].id),
      applied: status === 'applied',
      reason,
      appliedPatches,
    };
  }

  private fieldValue(value: unknown): number | null {
    if (value === null || typeof value === 'undefined') {
      return null;
    }
    return Number(value);
  }

  private parsePatches(value: unknown): CalibrationPatch[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value as CalibrationPatch[];
  }
}
