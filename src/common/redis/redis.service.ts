import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('redis.host') || 'localhost';
    const port = this.configService.get<number>('redis.port') || 6379;
    const password = this.configService.get<string>('redis.password');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    this.client.on('ready', () => {
      this.logger.log(`Redis connected (${host}:${port})`);
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error (fail-open active): ${err.message}`);
    });
  }

  /** Kết nối Redis khi module khởi tạo; nếu lỗi vẫn cho app chạy (Fail-Open). */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (err) {
      this.logger.warn(
        `Initial Redis connection failed (app continues without cache): ${(err as Error).message}`,
      );
    }
  }

  /** Đóng kết nối Redis an toàn khi ứng dụng tắt. */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  /** Kiểm tra Redis đã sẵn sàng nhận lệnh hay chưa. */
  isAvailable(): boolean {
    return this.client.status === 'ready';
  }

  /** Đọc và parse dữ liệu JSON từ Redis theo key; trả null nếu miss hoặc lỗi. */
  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Redis GET failed for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Lưu dữ liệu dạng JSON vào Redis kèm thời gian hết hạn (TTL tính bằng giây). */
  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis SET failed for ${key}: ${(err as Error).message}`);
    }
  }

  /** Xóa một hoặc nhiều key cụ thể khỏi Redis. */
  async del(...keys: string[]): Promise<void> {
    if (!this.isAvailable() || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis DEL failed: ${(err as Error).message}`);
    }
  }

  /** Xóa các key khớp pattern bằng SCAN (từng lô 100 key) để không làm treo Redis. */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Redis SCAN/DEL failed for ${pattern}: ${(err as Error).message}`);
    }
  }
}

