import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../guards/roles.guard';
import { ROLES } from '../constants';

/**
 * @AdminOnly() — Decorator bảo vệ controller/route chỉ cho phép tài khoản `ADMIN` truy cập.
 *
 * Thứ tự thực thi: `JwtAuthGuard` (xác thực token & gắn `request.user`) -> `RolesGuard` (kiểm tra `role === 'ADMIN'`).
 */
export const AdminOnly = () =>
  applyDecorators(
    ApiBearerAuth(),
    Roles(ROLES.ADMIN),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ApiForbiddenResponse({ description: 'ADMIN role required' }),
  );

