import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class SessionLoginDto {
  @IsString()
  @MinLength(1)
  loginId!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsIn(['ios', 'mac'])
  clientKind?: 'ios' | 'mac';

  @IsOptional()
  @IsString()
  clientInstanceId?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}
