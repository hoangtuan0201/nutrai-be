import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { UploadAvatarDto } from './dto/upload-avatar.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * GET    /account/me           — basic account info (incl. avatarUrl)
 * POST   /account/avatar       — upload avatar to Cloudinary
 * GET    /account/preferences  — notification preferences
 * PATCH  /account/preferences  — update notification preferences
 * GET    /account/export       — export all personal data (JSON)
 * DELETE /account              — deactivate account (soft delete)
 */
@ApiTags('Account')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current account info' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.accountService.getMe(user.id);
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload avatar image' })
  uploadAvatar(@CurrentUser() user: AuthUser, @Body() dto: UploadAvatarDto) {
    return this.accountService.uploadAvatar(user.id, dto.imageBase64);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.accountService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) {
    return this.accountService.updatePreferences(user.id, dto);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all personal data' })
  exportData(@CurrentUser() user: AuthUser) {
    return this.accountService.exportData(user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Deactivate (soft delete) the account' })
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.accountService.deleteAccount(user.id);
  }
}

