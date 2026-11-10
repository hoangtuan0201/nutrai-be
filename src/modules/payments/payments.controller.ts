import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { SePayWebhookDto } from './dto/sepay-webhook.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments & Subscriptions')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List all active subscription plans (Free, Pro Monthly, Pro Yearly)' })
  getPlans() {
    return this.paymentsService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('subscription/me')
  @ApiOperation({ summary: 'Get current user subscription status, Pro badge, and recent payments' })
  getMySubscription(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getMySubscription(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('checkout')
  @ApiOperation({
    summary: 'Create a PENDING payment and generate VietQR (SePay) or Checkout Session (Stripe)',
  })
  createCheckout(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.paymentsService.createCheckout(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/status')
  @ApiOperation({
    summary: 'Check payment status (auto-verifies against SePay API v2 if still PENDING)',
  })
  getPaymentStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.getPaymentStatus(user.id, id);
  }

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

  @Post('sepay/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actively pull recent transactions from SePay API v2 and activate matching subscriptions',
  })
  syncSePayTransactions() {
    return this.paymentsService.syncSePayTransactions();
  }

  @Get('sepay/diagnostics')
  @ApiOperation({
    summary: 'Inspect connected SePay Sandbox/Production bank accounts, webhooks, and recent transactions',
  })
  getDiagnostics() {
    return this.paymentsService.getSePayGatewayDiagnostics();
  }

  @Post('webhooks/sepay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Official SePay webhook endpoint (returns 200 OK {"success": true})' })
  handleSePayWebhook(
    @Body() payload: SePayWebhookDto,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handleSePayWebhook(payload, authHeader);
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Official Stripe webhook endpoint' })
  handleStripeWebhook(
    @Body() payload: Record<string, any>,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') stripeSignature?: string,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(payload);
    return this.paymentsService.handleStripeWebhook(payload, rawBody, stripeSignature);
  }
}
