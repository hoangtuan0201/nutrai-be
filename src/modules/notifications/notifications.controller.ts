import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  RegisterDeviceTokenDto,
  RemoveDeviceTokenDto,
} from './dto/register-device-token.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import {
  TestStreakRescueDto,
  TestWeeklyWeighInDto,
  TestMealReminderDto,
} from './dto/test-notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('device-token')
  @ApiOperation({ summary: 'Register or update FCM / Expo push token for current device' })
  registerDeviceToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(user.id, dto);
  }

  @Delete('device-token')
  @ApiOperation({ summary: 'Deactivate device push token on logout' })
  removeDeviceToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RemoveDeviceTokenDto,
  ) {
    return this.notificationsService.removeDeviceToken(user.id, dto.token);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated notifications & unread count' })
  getNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getNotifications(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for Homepage bell badge' })
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post('test-push')
  @ApiOperation({ summary: 'Send a test push and in-app notification to current user' })
  sendTestNotification(@CurrentUser() user: AuthUser) {
    return this.notificationsService.sendToUser({
      userId: user.id,
      type: NotificationType.MEAL_REMINDER,
      title: 'NutrAI Push Active! 🔔',
      body: 'Great! Your device is connected to Firebase Cloud Messaging & NutrAI alerts.',
      data: {
        route: '/(main)/meals',
      },
    });
  }

  @Post('test-streak-alert')
  @ApiOperation({ summary: 'Test Streak Rescue Alert (checks real streak or force-dispatches push)' })
  testStreakAlert(
    @CurrentUser() user: AuthUser,
    @Body() dto: TestStreakRescueDto,
  ) {
    return this.notificationsService.checkAndSendStreakRescue(
      user.id,
      dto.force ?? true,
      dto.simulatedStreak ?? 3,
    );
  }

  @Post('test-weekly-weigh-in')
  @ApiOperation({ summary: 'Test Weekly Weigh-In reminder (checks or force-dispatches push)' })
  testWeeklyWeighIn(
    @CurrentUser() user: AuthUser,
    @Body() dto: TestWeeklyWeighInDto,
  ) {
    return this.notificationsService.checkAndSendWeeklyWeighIn(
      user.id,
      dto.force ?? true,
    );
  }

  @Post('test-meal-reminder')
  @ApiOperation({ summary: 'Test meal reminder logic (verifies meal-logged check or force-dispatches)' })
  testMealReminder(
    @CurrentUser() user: AuthUser,
    @Body() dto: TestMealReminderDto,
  ) {
    return this.notificationsService.checkAndSendMealReminder(
      user.id,
      dto.mealType,
      dto.force ?? false,
    );
  }
}

