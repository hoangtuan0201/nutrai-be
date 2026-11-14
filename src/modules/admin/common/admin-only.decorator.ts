import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ROLES } from '../../../common/constants';

/**
 * Protects a controller/handler so only authenticated ADMIN users can access it.
 * Order matters: JwtAuthGuard attaches request.user, then RolesGuard checks the role.
 */
export const AdminOnly = () =>
  applyDecorators(
    ApiBearerAuth(),
    Roles(ROLES.ADMIN),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ApiForbiddenResponse({ description: 'ADMIN role required' }),
  );

