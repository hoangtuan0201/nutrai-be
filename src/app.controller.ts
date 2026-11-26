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


}
