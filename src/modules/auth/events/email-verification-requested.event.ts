export class EmailVerificationRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly name: string | null,
    public readonly code: string,
    public readonly expiresAt: Date,
  ) {}
}

