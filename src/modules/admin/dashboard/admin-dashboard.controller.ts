import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/admin-only.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('Admin - Dashboard')
@AdminOnly()
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'New user sign-ups (today/week/month) and revenue (MRR/ARR, by gateway)' })
  @ApiOkResponse({ description: 'Dashboard overview metrics' })
  getOverview() {
    return this.dashboardService.getOverview();
  }
}

