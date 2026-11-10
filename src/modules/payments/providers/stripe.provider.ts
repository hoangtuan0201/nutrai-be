import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface StripeCheckoutResult {
  sessionId: string;
  checkoutUrl: string;
  paymentCode: string;
  amount: number;
  currency: string;
}

export interface NormalizedStripeEvent {
  eventId: string;
  eventType: string;
  sessionId: string;
  paymentCode: string | null;
  paymentId: string | null;
  userId: string | null;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  raw: Record<string, any>;
}

@Injectable()
export class StripeProvider {
  private readonly logger = new Logger(StripeProvider.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.successUrl =
      this.config.get<string>('STRIPE_SUCCESS_URL') ?? 'https://app.nutraai.com/payment/success';
    this.cancelUrl =
      this.config.get<string>('STRIPE_CANCEL_URL') ?? 'https://app.nutraai.com/payment/cancel';
  }

  isConfigured(): boolean {
    return Boolean(this.secretKey && this.secretKey.startsWith('sk_'));
  }

  /**
   * Creates a Stripe Checkout Session via Stripe REST API (`POST /v1/checkout/sessions`).
   * Ready to work immediately once `STRIPE_SECRET_KEY` is added to `.env`.
   */
  async createCheckoutSession(params: {
    paymentId: string;
    paymentCode: string;
    userId: string;
    userEmail?: string;
    planName: string;
    amount: number;
    currency: string;
  }): Promise<StripeCheckoutResult> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Stripe is not configured yet (missing STRIPE_SECRET_KEY). Please use SEPAY (VietQR) or configure STRIPE_SECRET_KEY in .env.',
      );
    }

    const currencyLower = (params.currency || 'VND').toLowerCase();
    // VND is a zero-decimal currency in Stripe; USD uses cents (* 100)
    const unitAmount =
      currencyLower === 'vnd' ? Math.round(params.amount) : Math.round(params.amount * 100);

    const body = new URLSearchParams({
      mode: 'payment',
      success_url: `${this.successUrl}?session_id={CHECKOUT_SESSION_ID}&payment_id=${params.paymentId}`,
      cancel_url: `${this.cancelUrl}?payment_id=${params.paymentId}`,
      client_reference_id: params.paymentId,
      'metadata[paymentId]': params.paymentId,
      'metadata[paymentCode]': params.paymentCode,
      'metadata[userId]': params.userId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currencyLower,
      'line_items[0][price_data][unit_amount]': String(unitAmount),
      'line_items[0][price_data][product_data][name]': `NutraAI ${params.planName}`,
    });

    if (params.userEmail) {
      body.set('customer_email', params.userEmail);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Stripe checkout session creation failed: ${errText}`);
      throw new BadRequestException('Failed to create Stripe Checkout Session');
    }

    const session = (await response.json()) as { id: string; url: string };
    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      paymentCode: params.paymentCode,
      amount: params.amount,
      currency: params.currency,
    };
  }

  /**
   * Verifies Stripe-Signature header (if `STRIPE_WEBHOOK_SECRET` is configured)
   * and normalizes the incoming Stripe webhook event.
   */
  verifyAndNormalizeWebhook(
    payload: Record<string, any>,
    rawBody?: string,
    stripeSignature?: string,
  ): NormalizedStripeEvent {
    if (this.webhookSecret && rawBody && stripeSignature) {
      this.verifySignature(rawBody, stripeSignature, this.webhookSecret);
    }

    const eventId = String(payload.id ?? `evt_${Date.now()}`);
    const eventType = String(payload.type ?? 'unknown');
    const obj = (payload.data?.object ?? {}) as Record<string, any>;
    const metadata = (obj.metadata ?? {}) as Record<string, any>;
    const currency = String(obj.currency ?? 'vnd').toUpperCase();
    const rawAmount = Number(obj.amount_total ?? obj.amount ?? 0);
    const amountTotal = currency === 'VND' ? rawAmount : rawAmount / 100;

    return {
      eventId,
      eventType,
      sessionId: String(obj.id ?? ''),
      paymentCode: metadata.paymentCode ? String(metadata.paymentCode) : null,
      paymentId: metadata.paymentId
        ? String(metadata.paymentId)
        : obj.client_reference_id
          ? String(obj.client_reference_id)
          : null,
      userId: metadata.userId ? String(metadata.userId) : null,
      amountTotal,
      currency,
      paymentStatus: String(obj.payment_status ?? obj.status ?? ''),
      raw: payload,
    };
  }

  private verifySignature(rawBody: string, header: string, secret: string): void {
    const parts = header.split(',').reduce<Record<string, string>>((acc, item) => {
      const [k, v] = item.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) {
      throw new UnauthorizedException('Malformed Stripe-Signature header');
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

    if (expected !== signature) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
  }
}

