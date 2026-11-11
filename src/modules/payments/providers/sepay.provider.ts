import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SePayWebhookDto } from '../dto/sepay-webhook.dto';

export interface SePayQrInfo {
  qrUrl: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  currency: string;
  paymentCode: string;
  transferContent: string;
}

export interface NormalizedSePayTransaction {
  eventId: string;
  gateway: string;
  accountNumber: string;
  transferType: 'in' | 'out';
  amount: number;
  content: string;
  code: string | null;
  referenceCode: string;
  transactionDate: string;
  raw: Record<string, any>;
}

@Injectable()
export class SePayProvider {
  private readonly logger = new Logger(SePayProvider.name);
  private readonly accessToken: string;
  private readonly apiBaseUrl: string;
  private readonly bankAccount: string;
  private readonly bankName: string;
  private readonly accountHolder: string;
  private readonly webhookApiKey: string;
  private txCache: { timestamp: number; data: NormalizedSePayTransaction[] } | null = null;

  constructor(private readonly config: ConfigService) {
    this.accessToken = this.config.get<string>('SEPAY_ACCESS_TOKEN') ?? '';
    this.apiBaseUrl =
      this.config.get<string>('SEPAY_API_BASE_URL') ?? 'https://userapi-sandbox.sepay.vn/v2';
    this.bankAccount = this.config.get<string>('SEPAY_BANK_ACCOUNT') ?? '0899223595';
    this.bankName = this.config.get<string>('SEPAY_BANK_NAME') ?? 'MBBank';
    this.accountHolder =
      this.config.get<string>('SEPAY_ACCOUNT_HOLDER') ?? 'TRAN HUU HOANG TUAN';
    this.webhookApiKey = this.config.get<string>('SEPAY_WEBHOOK_API_KEY') ?? '';
  }

  /**
   * Step 3 in SePay VietQR Flow:
   * Generates VietQR image URL and bank transfer details for the mobile client.
   */
  generateQr(params: { amount: number; paymentCode: string }): SePayQrInfo {
    const roundedAmount = Math.round(params.amount);
    const qrUrl =
      `https://qr.sepay.vn/img` +
      `?acc=${encodeURIComponent(this.bankAccount)}` +
      `&bank=${encodeURIComponent(this.bankName)}` +
      `&amount=${roundedAmount}` +
      `&des=${encodeURIComponent(params.paymentCode)}` +
      `&template=compact`;

    return {
      qrUrl,
      bankName: this.bankName,
      accountNumber: this.bankAccount,
      accountHolder: this.accountHolder,
      amount: roundedAmount,
      currency: 'VND',
      paymentCode: params.paymentCode,
      transferContent: params.paymentCode,
    };
  }

  /**
   * Verifies optional SePay Webhook API Key authentication header (`Authorization: Apikey <KEY>`).
   * If `SEPAY_WEBHOOK_API_KEY` is not set (e.g. `No_Authen` mode in SePay Sandbox), allows the request.
   */
  verifyWebhookAuth(authHeader?: string): void {
    if (!this.webhookApiKey) {
      return;
    }

    if (!authHeader) {
      throw new UnauthorizedException('Missing SePay webhook Authorization header');
    }

    const token = authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim();
    if (token !== this.webhookApiKey) {
      throw new UnauthorizedException('Invalid SePay webhook API key');
    }
  }

  /**
   * Normalizes both SePay Standard Webhook payloads and SePay User API v2 transaction objects
   * into a single consistent structure.
   */
  normalizeWebhookPayload(payload: SePayWebhookDto | Record<string, any>): NormalizedSePayTransaction {
    const raw = payload as Record<string, any>;

    const transferTypeRaw = String(
      raw.transferType ?? raw.transfer_type ?? (Number(raw.amount_in ?? 0) > 0 ? 'in' : 'out'),
    ).toLowerCase();
    const transferType: 'in' | 'out' = transferTypeRaw === 'out' ? 'out' : 'in';

    const amount = Number(
      raw.transferAmount ?? (transferType === 'in' ? raw.amount_in : raw.amount_out) ?? 0,
    );

    const content = String(
      raw.content ?? raw.transaction_content ?? raw.description ?? '',
    ).trim();

    const referenceCode = String(
      raw.referenceCode ?? raw.reference_number ?? raw.id ?? `SEPAY-${Date.now()}`,
    ).trim();

    const eventId = String(raw.id ?? referenceCode).trim();
    const gateway = String(raw.gateway ?? raw.bank_brand_name ?? this.bankName).trim();
    const accountNumber = String(
      raw.accountNumber ?? raw.account_number ?? this.bankAccount,
    ).trim();
    const transactionDate = String(
      raw.transactionDate ?? raw.transaction_date ?? new Date().toISOString(),
    ).trim();
    const code = raw.code ? String(raw.code).trim() : null;

    return {
      eventId,
      gateway,
      accountNumber,
      transferType,
      amount,
      content,
      code,
      referenceCode,
      transactionDate,
      raw,
    };
  }

  /**
   * Queries SePay User API v2 (`GET /v2/bank-accounts`) using the configured access token.
   */
  async fetchBankAccounts(): Promise<any[]> {
    if (!this.accessToken) {
      this.logger.warn('SEPAY_ACCESS_TOKEN is not configured');
      return [];
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/bank-accounts`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        this.logger.warn(`SePay fetchBankAccounts returned HTTP ${response.status}`);
        return [];
      }
      const json = (await response.json()) as { data?: any[] };
      return Array.isArray(json.data) ? json.data : [];
    } catch (err) {
      this.logger.error(`Failed to fetch SePay bank accounts: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Queries SePay User API v2 (`GET /v2/webhooks`) to inspect configured webhooks.
   */
  async fetchWebhooks(): Promise<any[]> {
    if (!this.accessToken) return [];

    try {
      const response = await fetch(`${this.apiBaseUrl}/webhooks`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) return [];
      const json = (await response.json()) as { data?: any[] };
      return Array.isArray(json.data) ? json.data : [];
    } catch (err) {
      this.logger.error(`Failed to fetch SePay webhooks: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Queries SePay User API v2 (`GET /v2/transactions`) to list recent bank transactions.
   * Includes a 4-second in-memory cache to respect SePay API v2 rate limits (2 req/sec).
   */
  async fetchTransactions(limit = 20, forceRefresh = false): Promise<NormalizedSePayTransaction[]> {
    if (!this.accessToken) {
      this.logger.warn('SEPAY_ACCESS_TOKEN is not configured');
      return [];
    }

    const now = Date.now();
    if (!forceRefresh && this.txCache && now - this.txCache.timestamp < 8000) {
      return this.txCache.data;
    }

    try {
      const url = `${this.apiBaseUrl}/transactions?limit=${limit}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 429 && this.txCache) {
        return this.txCache.data;
      }

      if (!response.ok) {
        this.logger.warn(`SePay fetchTransactions returned HTTP ${response.status}`);
        return this.txCache?.data ?? [];
      }

      const json = (await response.json()) as { data?: Record<string, any>[] };
      const rows = Array.isArray(json.data) ? json.data : [];
      const normalized = rows.map((row) => this.normalizeWebhookPayload(row));
      this.txCache = { timestamp: now, data: normalized };
      return normalized;
    } catch (err) {
      this.logger.error(`Failed to fetch SePay transactions: ${(err as Error).message}`);
      return this.txCache?.data ?? [];
    }
  }

  /**
   * Searches recent SePay transactions via API v2 for a matching payment code & amount.
   */
  async findMatchingTransaction(
    paymentCode: string,
    minAmount: number,
  ): Promise<NormalizedSePayTransaction | null> {
    const transactions = await this.fetchTransactions(30);
    const normalizedCode = paymentCode.trim().toUpperCase();

    for (const tx of transactions) {
      if (tx.transferType !== 'in') continue;
      const upperContent = tx.content.toUpperCase();
      const upperCode = (tx.code ?? '').toUpperCase();

      const codeMatches =
        upperContent.includes(normalizedCode) ||
        upperCode === normalizedCode;

      if (codeMatches && tx.amount >= minAmount) {
        return tx;
      }
    }

    return null;
  }
}
