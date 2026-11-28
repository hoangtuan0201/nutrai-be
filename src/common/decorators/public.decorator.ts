import { SetMetadata } from '@nestjs/common';

/**
 * @Public() — Đánh dấu route công khai để `JwtAuthGuard` bỏ qua kiểm tra Bearer token.
 *
 * Ví dụ:
 *   @Public()
 *   @Post('auth/google')
 *   loginWithGoogle() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
