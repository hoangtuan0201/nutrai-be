import { SetMetadata } from '@nestjs/common';

/**
 * @Public() decorator — marks a route as publicly accessible (no JWT required).
 *
 * Usage:
 *   @Public()
 *   @Post('auth/google')
 *   loginWithGoogle() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
