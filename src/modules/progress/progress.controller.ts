import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { LogWeightDto } from './dto/log-weight.dto';
import { ProgressQueryDto } from './dto/progress-query.dto';
import { UpdateCalorieTargetDto } from './dto/update-calorie-target.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Get comprehensive progress overview (BMI, weight, calorie charts, streak)' })
  @ApiResponse({ status: 200, description: 'Progress overview returned.' })
  async getProgressOverview(
    @CurrentUser() user: AuthUser,
    @Query() query: ProgressQueryDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.progressService.getProgressOverview(user.id, query.days || 7);
  }

  @Post('weight')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Log or update daily body weight' })
  @ApiResponse({ status: 201, description: 'Weight log created or updated.' })
  async logWeight(
    @CurrentUser() user: AuthUser,
    @Body() dto: LogWeightDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.progressService.logWeight(user.id, dto);
  }

  @Get('weight-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get weight log history entries' })
  @ApiResponse({ status: 200, description: 'Weight log history list returned.' })
  async getWeightHistory(@CurrentUser() user: AuthUser) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.progressService.getWeightHistory(user.id);
  }

  @Put('calorie-target')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update daily calorie intake target' })
  @ApiResponse({ status: 200, description: 'Calorie target updated successfully.' })
  async updateCalorieTarget(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCalorieTargetDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.progressService.updateCalorieTarget(user.id, dto.dailyCalories);
  }
}
