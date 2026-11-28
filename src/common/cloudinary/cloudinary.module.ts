import { Global, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

/**
 * CloudinaryModule — Module `@Global()` cung cấp `CloudinaryService` cho toàn bộ ứng dụng
 * mà không cần import lại ở từng module con.
 */
@Global()
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
