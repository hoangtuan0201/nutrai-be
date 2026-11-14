import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { AdminOnly } from '../common/admin-only.decorator';
import { AdminPaymentsService } from './admin-payments.service';
import {
  ManualActivateDto,
  QueryAdminPaymentsDto,
  QueryPaymentEventsDto,
} from './dto/admin-payments.dto';

@ApiTags('Admin - Payments')
@AdminOnly()
@Controller('admin')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: AdminPaymentsService) {}

  @Get('payments')
  @ApiOperation({ summary: 'List payments (filter by status / gateway, search code / email)' })
  @ApiOkResponse({ description: 'Paginated payment list' })
  listPayments(@Query() query: QueryAdminPaymentsDto) {
    return this.paymentsService.listPayments(query);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Payment detail with its webhook events' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  getPayment(@Param('id') id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Post('payments/:id/manual-activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually mark a PENDING/EXPIRED/FAILED payment as paid and activate Pro' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiConflictResponse({ description: 'Payment already completed' })
  manualActivate(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: ManualActivateDto,
  ) {
    return this.paymentsService.manualActivate(id, admin.id, dto);
  }

  @Get('payment-events')
  @ApiOperation({ summary: 'Webhook logs from SePay / Stripe for reconciliation' })
  @ApiOkResponse({ description: 'Paginated webhook event list' })
  listPaymentEvents(@Query() query: QueryPaymentEventsDto) {
    return this.paymentsService.listPaymentEvents(query);
  }
}

