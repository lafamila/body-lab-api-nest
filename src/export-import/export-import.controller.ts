import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportBodyLabDataDto } from './dto';
import { ExportImportService } from './export-import.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ExportImportController {
  constructor(private readonly exportImportService: ExportImportService) {}

  @Get('export')
  export(@AuthAccountParam() account: AuthAccount) {
    return this.exportImportService.export(account.accountId);
  }

  @Post('import')
  import(@AuthAccountParam() account: AuthAccount, @Body() body: ImportBodyLabDataDto) {
    return this.exportImportService.import(account.accountId, body);
  }
}
