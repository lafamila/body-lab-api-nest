import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { BodyLabSessionGuard } from '../auth/body-lab-session.guard';
import { DaysService } from './days.service';
import { UpsertDayDto } from './dto';

@UseGuards(BodyLabSessionGuard)
@Controller('days')
export class DaysController {
  constructor(private readonly daysService: DaysService) {}

  @Get(':date')
  getDay(@AuthAccountParam() account: AuthAccount, @Param('date') date: string) {
    return this.daysService.getDay(account.accountId, date);
  }

  @Patch(':date')
  updateDay(@AuthAccountParam() account: AuthAccount, @Param('date') date: string, @Body() body: UpsertDayDto) {
    return this.daysService.upsertDay(account.accountId, date, body);
  }
}
