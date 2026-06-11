import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class UpsertDayDto {
  @IsOptional()
  @IsNumber()
  morningWeightKg?: number;

  @IsOptional()
  @IsDateString()
  morningWeightMeasuredAt?: string;

}
