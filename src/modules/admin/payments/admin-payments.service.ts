import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PaymentProcessingService } from '../../payments/payment-processing.service';
import { toPaginated, toSkipTake } from '../common/pagination';
import {
  ManualActivateDto,
  QueryAdminPaymentsDto,
  QueryPaymentEventsDto,
} from './dto/admin-payments.dto';

const ACTIVATABLE_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.EXPIRED,
  PaymentStatus.FAILED,
];

const PAYMENT_LIST_INCLUDE = {
  user: { select: { id: true, email: true, name: true } },
  plan: { select: { id: true, name: true, billingPeriod: true } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProcessing: PaymentProcessingService,
  ) {}

  async listPayments(query: QueryAdminPaymentsDto) {
    const where = this.buildPaymentWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query.page, query.limit),
      }),
      this.prisma.payment.count({ where }),
    ]);
    return toPaginated(items, total, query.page, query.limit);
  }

  async getPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        ...PAYMENT_LIST_INCLUDE,
        subscription: { select: { id: true, status: true, startsAt: true, expiresAt: true } },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  /** Webhook log lookup for reconciliation (search by event id, transfer content or payment code). */
  async listPaymentEvents(query: QueryPaymentEventsDto) {
    const where = this.buildEventWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.paymentEvent.findMany({
        where,
        include: {
          payment: {
            select: { id: true, paymentCode: true, status: true, amount: true, userId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query.page, query.limit),
      }),
      this.prisma.paymentEvent.count({ where }),
    ]);
    return toPaginated(items, total, query.page, query.limit);
  }

  async manualActivate(paymentId: string, adminId: string, dto: ManualActivateDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.userId) throw new BadRequestException('Payment is not linked to any user');
    if (payment.status === PaymentStatus.COMPLETED) {
      throw new ConflictException('Payment is already completed — Pro is already active for it');
    }
    if (!ACTIVATABLE_STATUSES.includes(payment.status)) {
      throw new BadRequestException(`Cannot activate a payment with status ${payment.status}`);
    }

    this.logger.warn(
      `Admin ${adminId} manually activating Pro for payment=${paymentId} user=${payment.userId}`,
    );
    return this.paymentProcessing.activateManually({
      paymentId,
      userId: payment.userId,
      planId: payment.planId,
      amount: payment.amount,
      adminId,
      note: dto.note,
      bankReference: dto.bankReference,
    });
  }

  private buildPaymentWhere(query: QueryAdminPaymentsDto): Prisma.PaymentWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.method ? { paymentMethod: query.method } : {}),
      ...(search
        ? {
            OR: [
              { paymentCode: { contains: search, mode: 'insensitive' } },
              { transactionId: { contains: search, mode: 'insensitive' } },
              { providerTxId: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private buildEventWhere(query: QueryPaymentEventsDto): Prisma.PaymentEventWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.provider ? { provider: query.provider.toUpperCase() } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentId ? { paymentId: query.paymentId } : {}),
      ...(search
        ? {
            OR: [
              { eventId: { contains: search, mode: 'insensitive' } },
              { payload: { path: ['content'], string_contains: search } },
              { payment: { paymentCode: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }
}

