import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ScanFoodDto } from './dto/scan-food.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('scan-food')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Analyze meal photo using Gemini Multimodal Vision' })
  @ApiResponse({ status: 200, description: 'Food items and nutrition estimates successfully detected.' })
  @ApiResponse({ status: 400, description: 'Invalid image format or payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async scanFood(@Body() dto: ScanFoodDto) {
    return this.aiService.scanFood(dto);
  }
}
