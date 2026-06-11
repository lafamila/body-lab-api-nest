import { IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateWeightLogDto {
  @IsDateString()
  measuredAt!: string;

  @IsNumber()
  valueKg!: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class UpdateWeightLogDto {
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @IsOptional()
  @IsNumber()
  valueKg?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateMealLogDto {
  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsUUID()
  mealCategoryId?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class UpdateMealLogDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsUUID()
  mealCategoryId?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateDrinkLogDto {
  @IsDateString()
  occurredAt!: string;

  @IsIn(['water', 'coffee', 'other'])
  drinkType!: 'water' | 'coffee' | 'other';

  @IsOptional()
  @IsInt()
  @Min(0)
  amountMl?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  caffeineMg?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class UpdateDrinkLogDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsIn(['water', 'coffee', 'other'])
  drinkType?: 'water' | 'coffee' | 'other';

  @IsOptional()
  @IsInt()
  @Min(0)
  amountMl?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  caffeineMg?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateHealthImportDto {
  @IsIn(['body_mass', 'steps', 'workout'])
  sourceType!: 'body_mass' | 'steps' | 'workout';

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsObject()
  metric!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class UpdateHealthImportDto {
  @IsOptional()
  @IsIn(['body_mass', 'steps', 'workout'])
  sourceType?: 'body_mass' | 'steps' | 'workout';

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsObject()
  metric?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateManualWorkoutDto {
  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsUUID()
  exerciseCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  intensity?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class UpdateManualWorkoutDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsUUID()
  exerciseCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  intensity?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateBathroomLogDto {
  @IsDateString()
  occurredAt!: string;

  @IsIn(['urine', 'bowel'])
  bathroomType!: 'urine' | 'bowel';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class UpdateBathroomLogDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsIn(['urine', 'bowel'])
  bathroomType?: 'urine' | 'bowel';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
