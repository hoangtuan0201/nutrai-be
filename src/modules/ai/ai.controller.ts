import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiQuotaService } from './ai-quota.service';
import { ScanFoodDto } from './dto/scan-food.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiQuotaService: AiQuotaService,
  ) {}

  @Get('quota')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user daily AI scan and chat quotas (Free vs Pro)' })
  @ApiResponse({ status: 200, description: 'Daily AI quota status returned.' })
  async getAiQuota(@CurrentUser() user: AuthUser) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.aiQuotaService.getUserDailyQuota(user.id);
  }

  @Post('scan-food')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Analyze meal photo using Gemini Multimodal Vision (Quota guarded)' })
  @ApiResponse({ status: 200, description: 'Food items and nutrition estimates successfully detected.' })
  @ApiResponse({ status: 400, description: 'Invalid image format or payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Daily scan limit reached.' })
  async scanFood(
    @CurrentUser() user: AuthUser,
    @Body() dto: ScanFoodDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');

    // 1. Enforce quota: Free: 3/day, Pro: 20/day
    await this.aiQuotaService.assertCanScan(user.id);

    // 2. Perform AI food analysis
    const result = await this.aiService.scanFood(dto);

    // 3. Record scan to ai_meal_analyses table
    await this.aiQuotaService.recordSuccessfulScan(user.id, result, {
      foodHint: dto.foodHint,
    });

    // 4. Return result with remaining quota
    const updatedQuota = await this.aiQuotaService.getUserDailyQuota(user.id);

    return {
      ...result,
      quota: updatedQuota.scans,
    };
  }
}
