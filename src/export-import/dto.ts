import { IsInt, IsObject, Min } from 'class-validator';

export class ImportBodyLabDataDto {
  @IsInt()
  @Min(1)
  schemaVersion!: number;

  @IsObject()
  data!: Record<string, unknown>;
}
