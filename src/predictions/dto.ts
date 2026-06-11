import { IsDateString, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePredictionSnapshotDto {
  @IsDateString()
  targetDate!: string;

  @IsDateString()
  generatedAt!: string;

  @IsString()
  modelVersion!: string;

  @IsNumber()
  predictedWeightKg!: number;

  @IsOptional()
  @IsNumber()
  actualWeightKg?: number;

  @IsOptional()
  @IsObject()
  explanation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  inputSummary?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientSnapshotId?: string;
}

export class UpdatePredictionSnapshotDto {
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsDateString()
  generatedAt?: string;

  @IsOptional()
  @IsString()
  modelVersion?: string;

  @IsOptional()
  @IsNumber()
  predictedWeightKg?: number;

  @IsOptional()
  @IsNumber()
  actualWeightKg?: number;

  @IsOptional()
  @IsObject()
  explanation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  inputSummary?: Record<string, unknown>;
}
