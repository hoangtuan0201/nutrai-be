import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminOnly } from '../admin/common/admin-only.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { SePayWebhookDto } from './dto/sepay-webhook.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments & Subscriptions')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * GET /payments/plans — Lấy danh sách các gói dịch vụ đang mở bán (Free, Pro Monthly/Yearly)
   */
  @Get('plans')
  @ApiOperation({ summary: 'List all active subscription plans (Free, Pro Monthly, Pro Yearly)' })
  getPlans() {
    return this.paymentsService.getPlans();
  }

  /**
   * GET /payments/subscription/me — Lấy trạng thái gói Pro hiện tại & lịch sử thanh toán của user
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('subscription/me')
  @ApiOperation({ summary: 'Get current user subscription status, Pro badge, and recent payments' })
  getMySubscription(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getMySubscription(user.id);
  }

  /**
   * POST /payments/checkout — Tạo đơn PENDING (hủy đơn chờ cũ) & sinh mã VietQR SePay
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('checkout')
  @ApiOperation({
    summary: 'Create a PENDING payment and generate VietQR (SePay)',
  })
  createCheckout(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.paymentsService.createCheckout(user.id, dto);
  }

  /**
   * GET /payments/:id/status — Kiểm tra trạng thái đơn (tự đối soát SePay API v2 nếu còn PENDING)
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/status')
  @ApiOperation({
    summary: 'Check payment status (auto-verifies against SePay API v2 if still PENDING)',
  })
  getPaymentStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.getPaymentStatus(user.id, id);
  }

  /**
   * POST /payments/:id/verify — Chủ động đối soát ngay 1 đơn hàng với SePay User API v2
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actively reconcile a specific payment against SePay User API v2',
  })
  verifyPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.getPaymentStatus(user.id, id);
  }

  /**
   * POST /payments/:id/cancel — User chủ động hủy phiên thanh toán đang chờ
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an active pending payment order',
  })
  cancelPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.cancelPayment(user.id, id);
  }

  /**
   * POST /payments/sepay/sync — Kéo giao dịch mới từ SePay API v2 và kích hoạt các đơn khớp mã
   */
  @AdminOnly()
  @Post('sepay/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actively pull recent transactions from SePay API v2 and activate matching subscriptions',
  })
  syncSePayTransactions() {
    return this.paymentsService.syncSePayTransactions();
  }

  /**
   * GET /payments/sepay/diagnostics — Kiểm tra kết nối tài khoản ngân hàng & webhook trên SePay
   */
  @AdminOnly()
  @Get('sepay/diagnostics')
  @ApiOperation({
    summary: 'Inspect connected SePay Sandbox/Production bank accounts, webhooks, and recent transactions',
  })
  getDiagnostics() {
    return this.paymentsService.getSePayGatewayDiagnostics();
  }

  /**
   * POST /payments/webhooks/sepay — Endpoint Webhook chính thức nhận biến động số dư từ SePay
   */
  @Post('webhooks/sepay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Official SePay webhook endpoint (returns 200 OK {"success": true})' })
  handleSePayWebhook(
    @Body() payload: SePayWebhookDto,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handleSePayWebhook(payload, authHeader);
  }
}
