import { IsBoolean, IsDateString, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertDayDto {
  @IsOptional()
  @IsNumber()
  morningWeightKg?: number;

  @IsOptional()
  @IsDateString()
  morningWeightMeasuredAt?: string;

  @IsOptional()
  @IsBoolean()
  noMeals?: boolean;

  @IsOptional()
  @IsDateString()
  lastMealAt?: string | null;

  @IsOptional()
  @IsString()
  lastMealCategory?: string | null;

  @IsOptional()
  @IsNumber()
  lastMealPortion?: number | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
