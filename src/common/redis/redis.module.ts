import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * RedisModule — Module `@Global()` cung cấp `RedisService` dùng chung cho caching toàn hệ thống.
 * Khi chạy `be-nutraai` cùng Redis ở `localhost:6379`, có thể kiểm tra key đang được cache bằng `redis-cli`:

  # Xem tất cả key Food Search đang được cache trong Redis
  redis-cli KEYS "foods:*"

  # Xem thời gian sống còn lại (TTL tính bằng giây) của danh sách mặc định
  redis-cli TTL "foods:local:default"

  # Xóa thủ công toàn bộ cache food nếu cần test cold-cache
  redis-cli --scan --pattern "foods:*" | xargs redis-cli DEL
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

