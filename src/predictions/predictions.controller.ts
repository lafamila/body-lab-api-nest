import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePredictionSnapshotDto, UpdatePredictionSnapshotDto } from './dto';
import { PredictionsService } from './predictions.service';

@UseGuards(JwtAuthGuard)
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get()
  list(@AuthAccountParam() account: AuthAccount, @Query('since') since?: string) {
    return this.predictionsService.list(account.accountId, since);
  }

  @Post()
  create(@AuthAccountParam() account: AuthAccount, @Body() body: CreatePredictionSnapshotDto) {
    return this.predictionsService.create(account.accountId, body);
  }

  @Patch(':id')
  update(@AuthAccountParam() account: AuthAccount, @Param('id') id: string, @Body() body: UpdatePredictionSnapshotDto) {
    return this.predictionsService.update(account.accountId, id, body);
  }

  @Delete(':id')
  delete(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.predictionsService.delete(account.accountId, id);
  }
}
