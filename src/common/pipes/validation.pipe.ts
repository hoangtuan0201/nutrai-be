import { ValidationPipe, ValidationError, BadRequestException } from '@nestjs/common';

/**
 * CustomValidationPipe — Pipe validate DTO toàn cục (đăng ký trong `main.ts`).
 *
 * Nhiệm vụ & tầm quan trọng:
 * - Kích hoạt toàn bộ rule `class-validator` trên DTO đầu vào.
 * - `whitelist: true`: tự động loại bỏ các field thừa không khai báo trong DTO (chống gửi chèn field nhạy cảm).
 * - `transform: true`: tự động ép kiểu (vd query string -> number).
 * - Chuẩn hóa response lỗi 400 thành `{ statusCode, error, message, errors }` theo từng field.
 */
export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const formattedErrors = errors.reduce((acc, error) => {
          acc[error.property] = Object.values(error.constraints || {});
          return acc;
        }, {} as Record<string, string[]>);

        return new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          errors: formattedErrors,
        });
      },
    });
  }
}
