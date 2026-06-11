import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { BodyLabSessionGuard } from '../auth/body-lab-session.guard';
import {
  CreateBathroomLogDto,
  CreateDrinkLogDto,
  CreateHealthImportDto,
  CreateManualWorkoutDto,
  CreateMealLogDto,
  CreateWeightLogDto,
  UpdateBathroomLogDto,
  UpdateDrinkLogDto,
  UpdateHealthImportDto,
  UpdateManualWorkoutDto,
  UpdateMealLogDto,
  UpdateWeightLogDto,
} from './dto';
import { LogsService } from './logs.service';

@UseGuards(BodyLabSessionGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('weights')
  listWeights(@AuthAccountParam() account: AuthAccount, @Query('since') since?: string) {
    return this.logsService.list('weights', account.accountId, since);
  }

  @Post('weights')
  createWeight(@AuthAccountParam() account: AuthAccount, @Body() body: CreateWeightLogDto) {
    return this.logsService.create('weights', account.accountId, body);
  }

  @Patch('weights/:id')
  updateWeight(@AuthAccountParam() account: AuthAccount, @Param('id') id: string, @Body() body: UpdateWeightLogDto) {
    return this.logsService.update('weights', account.accountId, id, body);
  }

  @Delete('weights/:id')
  deleteWeight(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.logsService.delete('weights', account.accountId, id);
  }

  @Get('meals')
  listMeals(@AuthAccountParam() account: AuthAccount, @Query('since') since?: string) {
    return this.logsService.list('meals', account.accountId, since);
  }

  @Post('meals')
  createMeal(@AuthAccountParam() account: AuthAccount, @Body() body: CreateMealLogDto) {
    return this.logsService.create('meals', account.accountId, body);
  }

  @Patch('meals/:id')
  updateMeal(@AuthAccountParam() account: AuthAccount, @Param('id') id: string, @Body() body: UpdateMealLogDto) {
    return this.logsService.update('meals', account.accountId, id, body);
  }

  @Delete('meals/:id')
  deleteMeal(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.logsService.delete('meals', account.accountId, id);
  }

  @Get('drinks')
  listDrinks(@AuthAccountParam() account: AuthAccount, @Query('since') since?: string) {
    return this.logsService.list('drinks', account.accountId, since);
  }

  @Post('drinks')
  createDrink(@AuthAccountParam() account: AuthAccount, @Body() body: CreateDrinkLogDto) {
    return this.logsService.create('drinks', account.accountId, body);
  }

  @Patch('drinks/:id')
  updateDrink(@AuthAccountParam() account: AuthAccount, @Param('id') id: string, @Body() body: UpdateDrinkLogDto) {
    return this.logsService.update('drinks', account.accountId, id, body);
  }

  @Delete('drinks/:id')
  deleteDrink(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.logsService.delete('drinks', account.accountId, id);
  }

  @Get('health-imports')
  listHealthImports(@AuthAccountParam() account: AuthAccount, @Query('since') since?: string) {
    return this.logsService.list('health-imports', account.accountId, since);
  }

  @Post('health-imports')
  createHealthImport(@AuthAccountParam() account: AuthAccount, @Body() body: CreateHealthImportDto) {
    return this.logsService.create('health-imports', account.accountId, body);
  }

  @Patch('health-imports/:id')
  updateHealthImport(
    @AuthAccountParam() account: AuthAccount,
    @Param('id') id: string,
    @Body() body: UpdateHealthImportDto,
  ) {
    return this.logsService.update('health-imports', account.accountId, id, body);
  }

  @Delete('health-imports/:id')
  deleteHealthImport(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.logsService.delete('health-imports', account.accountId, id);
  }

  @Get('manual-workouts')
  listManualWorkouts(@AuthAccountParam() account: AuthAccount, @Query('since') since?: string) {
    return this.logsService.list('manual-workouts', account.accountId, since);
  }

  @Post('manual-workouts')
  createManualWorkout(@AuthAccountParam() account: AuthAccount, @Body() body: CreateManualWorkoutDto) {
    return this.logsService.create('manual-workouts', account.accountId, body);
  }

  @Patch('manual-workouts/:id')
  updateManualWorkout(
    @AuthAccountParam() account: AuthAccount,
    @Param('id') id: string,
    @Body() body: UpdateManualWorkoutDto,
  ) {
    return this.logsService.update('manual-workouts', account.accountId, id, body);
  }

  @Delete('manual-workouts/:id')
  deleteManualWorkout(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.logsService.delete('manual-workouts', account.accountId, id);
  }

  @Get('bathroom')
  listBathroom(@AuthAccountParam() account: AuthAccount, @Query('since') since?: string) {
    return this.logsService.list('bathroom', account.accountId, since);
  }

  @Post('bathroom')
  createBathroom(@AuthAccountParam() account: AuthAccount, @Body() body: CreateBathroomLogDto) {
    return this.logsService.create('bathroom', account.accountId, body);
  }

  @Patch('bathroom/:id')
  updateBathroom(@AuthAccountParam() account: AuthAccount, @Param('id') id: string, @Body() body: UpdateBathroomLogDto) {
    return this.logsService.update('bathroom', account.accountId, id, body);
  }

  @Delete('bathroom/:id')
  deleteBathroom(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.logsService.delete('bathroom', account.accountId, id);
  }
}
