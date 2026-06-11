import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export type PredictionConfigKind = 'global' | 'meal' | 'drink' | 'bathroom' | 'workout';

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
  updatedAt!: string;
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
}
