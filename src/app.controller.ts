import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { PaymentsService } from './modules/payments/payments.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Root webhook fallback (`POST /` and `POST /webhooks/sepay`) so that if SePay
   * is configured with the root tunnel URL (e.g. `https://roamer-arrogant-mace.ngrok-free.dev`),
   * it receives `200 OK {"success": true}` instead of `404 Not Found`.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  handleRootSePayWebhook(
    @Body() payload: Record<string, any>,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handleSePayWebhook(payload, authHeader);
  }

  @Post('webhooks/sepay')
  @HttpCode(HttpStatus.OK)
  handleAliasSePayWebhook(
    @Body() payload: Record<string, any>,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handleSePayWebhook(payload, authHeader);
  }
}
