import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { PaymentsService } from './modules/payments/payments.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * GET / — Kiểm tra server hoạt động (Health ping)
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * POST / — Webhook SePay dự phòng ở root domain (tránh 404 khi tunnel trỏ thẳng về root)
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  handleRootSePayWebhook(
    @Body() payload: Record<string, any>,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handleSePayWebhook(payload, authHeader);
  }

  /**
   * POST /webhooks/sepay — Alias nhận Webhook SePay rút gọn
   */
  @Post('webhooks/sepay')
  @HttpCode(HttpStatus.OK)
  handleAliasSePayWebhook(
    @Body() payload: Record<string, any>,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handleSePayWebhook(payload, authHeader);
  }
}
