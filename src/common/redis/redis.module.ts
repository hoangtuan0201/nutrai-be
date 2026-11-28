import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * RedisModule — Module `@Global()` cung cấp `RedisService` dùng chung cho caching toàn hệ thống.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

