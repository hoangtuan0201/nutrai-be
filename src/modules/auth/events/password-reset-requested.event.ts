/**
 * PasswordResetRequestedEvent
 *
 * Published by AuthService after a valid password reset token is generated.
 * The handler runs asynchronously — the HTTP response is NOT blocked by email sending.
 */
export class PasswordResetRequestedEvent {
  constructor(
    /** Internal user ID */
    public readonly userId: string,
    /** User's email address — destination for the reset link */
    public readonly email: string,
    /** Secure random token (64 hex chars) stored in PasswordReset table */
    public readonly resetToken: string,
    /** Token expiry so the email can display "link valid for X minutes" */
    public readonly expiresAt: Date,
  ) {}
}
