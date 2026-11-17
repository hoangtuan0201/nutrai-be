import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { AdminOnly } from '../common/admin-only.decorator';
import { AdminNotificationsService } from './admin-notifications.service';
import {
  BroadcastNotificationDto,
  QueryBroadcastHistoryDto,
} from './dto/admin-notifications.dto';

@ApiTags('Admin - Notifications')
@AdminOnly()
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: AdminNotificationsService) {}

  /**
   * GET /admin/notifications/stats — Thống kê số thiết bị đang bật Push Notification
   */
  @Get('stats')
  @ApiOperation({ summary: 'Active device token counts by platform (FCM/Expo push reach)' })
  @ApiOkResponse({ description: 'Device token statistics' })
  getDeviceTokenStats() {
    return this.notificationsService.getDeviceTokenStats();
  }

  /**
   * POST /admin/notifications/broadcast — Gửi thông báo đẩy hàng loạt (ALL / FREE / INACTIVE_3D)
   */
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send push + in-app broadcast to ALL, FREE, or INACTIVE_3D users' })
  @ApiOkResponse({ description: 'Broadcast delivery summary' })
  sendBroadcast(@CurrentUser() admin: AuthUser, @Body() dto: BroadcastNotificationDto) {
    return this.notificationsService.sendBroadcast(admin.id, dto);
  }

  /**
   * GET /admin/notifications/history — Lịch sử các chiến dịch Broadcast đã gửi
   */
  @Get('history')
  @ApiOperation({ summary: 'List sent broadcast campaigns with delivery success rate & active token stats' })
  @ApiOkResponse({ description: 'Paginated broadcast history' })
  listBroadcastHistory(@Query() query: QueryBroadcastHistoryDto) {
    return this.notificationsService.listBroadcastHistory(query);
  }
}
