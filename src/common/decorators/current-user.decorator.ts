import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Shape attached to request.user by JwtAuthGuard */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/**
 * @CurrentUser() — Param decorator lấy thông tin user đã xác thực từ `request.user`
 * (do `JwtAuthGuard` gắn vào sau khi verify Bearer token).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

