import {
  Controller,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * ProfileController
 *
 * GET /profile  — profile + BMR/TDEE + active nutrition target
 * PUT /profile  — update fields, recalculate & upsert NutritionTarget
 *
 * All routes require a valid JWT via JwtAuthGuard.
 */
@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns profile data with calculated BMR, TDEE, calorie target, and active NutritionTarget.',
  })
  @ApiResponse({ status: 200, description: 'Profile retrieved', type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@CurrentUser() user: AuthUser): Promise<ProfileResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.profileService.getProfile(user.id);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Updates profile fields. When all required fields are present, recalculates and persists a new NutritionTarget.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated', type: ProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.profileService.updateProfile(user.id, dto);
  }
}
