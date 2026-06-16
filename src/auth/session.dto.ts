import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class OidcStartLoginDto {
  @IsOptional()
  @IsIn(['ios', 'mac'])
  clientKind?: 'ios' | 'mac';

  @IsOptional()
  @IsString()
  clientInstanceId?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  returnUri?: string;
}

export class OidcCompleteLoginDto {
  @IsString()
  @MinLength(16)
  loginTransactionId!: string;
}
