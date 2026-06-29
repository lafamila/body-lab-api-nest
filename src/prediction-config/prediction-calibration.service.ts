import { BadRequestException, Injectable } from '@nestjs/common';
import { SyncService } from '../sync/sync.service';
import { CreatePredictionCalibrationDto, PredictionCalibrationResultDto } from './dto';
import { PredictionCalibrationRepository, CalibrationPatch } from './prediction-calibration.repository';
import { PredictionConfigService } from './prediction-config.service';

const MAX_PATCHES = 20;

@Injectable()
export class PredictionCalibrationService {
  constructor(
    private readonly repository: PredictionCalibrationRepository,
    private readonly predictionConfig: PredictionConfigService,
    private readonly sync: SyncService,
  ) {}

  async calibrate(accountId: string, body: CreatePredictionCalibrationDto): Promise<PredictionCalibrationResultDto> {
    if (!Number.isFinite(body.residualKg) || Math.abs(body.residualKg) > 3) {
      throw new BadRequestException('Calibration residual is outside the accepted range');
    }
    if (Math.abs(body.residualKg) < 0.1) {
      return this.repository.applyCalibration(accountId, {
        previousWeightId: body.previousWeightId,
        newWeightId: body.newWeightId,
        predictedWeightKg: body.predictedWeightKg,
        actualWeightKg: body.actualWeightKg,
        residualKg: body.residualKg,
        proposedPatches: [],
      });
    }
    if (body.proposedPatches.length > MAX_PATCHES) {
      throw new BadRequestException('Too many calibration patches');
    }

    const patches = body.proposedPatches
      .map((patch) => this.normalizePatch(patch))
      .filter((patch) => patch.sensitivity > 0 && patch.oldValue !== patch.proposedValue);
    const result = await this.repository.applyCalibration(accountId, {
      previousWeightId: body.previousWeightId,
      newWeightId: body.newWeightId,
      predictedWeightKg: body.predictedWeightKg,
      actualWeightKg: body.actualWeightKg,
      residualKg: body.residualKg,
      proposedPatches: patches,
    });
    if (result.applied) {
      await this.sync.publishPredictionConfig(accountId, await this.predictionConfig.list(accountId, false));
    }
    return result;
  }

  private normalizePatch(patch: CalibrationPatch): CalibrationPatch {
    if (!Number.isFinite(patch.oldValue) || !Number.isFinite(patch.proposedValue) || !Number.isFinite(patch.sensitivity)) {
      throw new BadRequestException('Calibration patch contains invalid numbers');
    }
    const allowed = this.allowedField(patch.kind, patch.field);
    if (!allowed) {
      throw new BadRequestException(`Calibration cannot update ${patch.kind}.${patch.key}.${patch.field}`);
    }
    return {
      kind: patch.kind,
      key: patch.key,
      field: patch.field,
      oldValue: this.round(patch.oldValue, patch.field),
      proposedValue: this.clampProposedValue(patch.oldValue, patch.proposedValue, patch.kind, patch.field),
      sensitivity: Math.abs(patch.sensitivity),
    };
  }

  private allowedField(kind: CalibrationPatch['kind'], field: CalibrationPatch['field']): boolean {
    if (kind === 'global') {
      return field === 'massKg';
    }
    if (kind === 'meal') {
      return field === 'stoolRatio';
    }
    if (kind === 'drink' || kind === 'bathroom') {
      return field === 'massKg';
    }
    if (kind === 'workout') {
      return field === 'minuteFactor';
    }
    return false;
  }

  private clampProposedValue(
    oldValue: number,
    proposedValue: number,
    kind: CalibrationPatch['kind'],
    field: CalibrationPatch['field'],
  ): number {
    const maxStep = this.maxStep(oldValue, kind, field);
    const stepped = Math.min(oldValue + maxStep, Math.max(oldValue - maxStep, proposedValue));
    return this.clampFieldRange(stepped, field);
  }

  private maxStep(oldValue: number, kind: CalibrationPatch['kind'], field: CalibrationPatch['field']): number {
    if (kind === 'global') {
      return 0.005;
    }
    if (field === 'stoolRatio') {
      return 0.03;
    }
    const relative = Math.abs(oldValue) * 0.1;
    return Math.max(0.001, Math.min(0.05, relative || 0.005));
  }

  private clampFieldRange(value: number, field: CalibrationPatch['field']): number {
    if (field === 'stoolRatio') {
      return this.round(Math.min(1, Math.max(0, value)), field);
    }
    if (field === 'minuteFactor') {
      return this.round(Math.min(0.05, Math.max(0, value)), field);
    }
    return this.round(Math.min(5, Math.max(-5, value)), field);
  }

  private round(value: number, field: CalibrationPatch['field']): number {
    const scale = field === 'minuteFactor' ? 100_000 : 10_000;
    return Math.round(value * scale) / scale;
  }
}
