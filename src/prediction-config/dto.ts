import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export type PredictionConfigKind = 'global' | 'meal' | 'drink' | 'bathroom' | 'workout';
export type PredictionConfigMetadata = Record<string, unknown>;

export class PredictionConfigItemDto {
  id!: string;
  kind!: PredictionConfigKind;
  key!: string;
  label!: string;
  massKg!: number | null;
  stoolRatio!: number | null;
  minuteFactor!: number | null;
  sortOrder!: number;
  isActive!: boolean;
  metadata!: PredictionConfigMetadata;
  updatedAt!: string;
}

export class PredictionConfigGlobalRequirementDto {
  key!: string;
  label!: string;
  present!: boolean;
  item!: PredictionConfigItemDto | null;
}

export class PredictionConfigKindRequirementDto {
  kind!: Exclude<PredictionConfigKind, 'global'>;
  minActive!: number;
  activeCount!: number;
  present!: boolean;
}

export class PredictionConfigStatusDto {
  isReady!: boolean;
  requiresSetup!: boolean;
  missingGlobalKeys!: string[];
  missingKinds!: Exclude<PredictionConfigKind, 'global'>[];
  requiredGlobals!: PredictionConfigGlobalRequirementDto[];
  requiredKinds!: PredictionConfigKindRequirementDto[];
  checkedAt!: string;
}

export class UpsertPredictionConfigItemDto {
  @IsIn(['global', 'meal', 'drink', 'bathroom', 'workout'])
  kind!: PredictionConfigKind;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  key!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsNumber()
  massKg?: number | null;

  @IsOptional()
  @IsNumber()
  stoolRatio?: number | null;

  @IsOptional()
  @IsNumber()
  minuteFactor?: number | null;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: PredictionConfigMetadata;
}
