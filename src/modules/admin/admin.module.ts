import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminFoodsController } from './foods/admin-foods.controller';
import { AdminFoodsService } from './foods/admin-foods.service';
import { AdminNotificationsController } from './notifications/admin-notifications.controller';
import { AdminNotificationsService } from './notifications/admin-notifications.service';
import { AdminPaymentsController } from './payments/admin-payments.controller';
import { AdminPaymentsService } from './payments/admin-payments.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CloudinaryModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminFoodsController,
    AdminPaymentsController,
    AdminNotificationsController,
  ],
  providers: [
    RolesGuard,
    AdminDashboardService,
    AdminUsersService,
    AdminFoodsService,
    AdminPaymentsService,
    AdminNotificationsService,
  ],
})
export class AdminModule {}

