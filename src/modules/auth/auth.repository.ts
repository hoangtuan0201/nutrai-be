import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { FirebaseDecodedToken } from '../firebase/firebase-auth.service';

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string | null;
  authProvider: string;
  isActive: boolean;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<UserRow | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, name: true, role: true,
        passwordHash: true, authProvider: true, isActive: true,
      },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true },
    });
  }

  createEmailUser(data: {
    email: string;
    passwordHash: string;
    name?: string | null;
  }): Promise<UserRow> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name ?? null,
        authProvider: 'EMAIL',
        role: 'USER',
        isActive: true,
        emailVerified: false,
      },
      select: {
        id: true, email: true, name: true, role: true,
        passwordHash: true, authProvider: true, isActive: true,
      },
    });
  }

  async upsertGoogleUser(decoded: FirebaseDecodedToken): Promise<{ user: UserRow; isNewUser: boolean }> {
    const firebaseUid = decoded.uid;
    const email = decoded.email.toLowerCase().trim();
    const name = decoded.name ?? null;
    const avatarUrl = decoded.picture ?? null;

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ firebaseUid }, { email }] },
    });

    if (!existing) {
      const user = await this.prisma.user.create({
        data: { email, name, avatarUrl, firebaseUid, authProvider: 'GOOGLE', role: 'USER', isActive: true, emailVerified: true },
        select: { id: true, email: true, name: true, role: true, passwordHash: true, authProvider: true, isActive: true },
      });
      return { user, isNewUser: true };
    }

    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: { firebaseUid, emailVerified: true, ...(name && { name }), ...(avatarUrl && { avatarUrl }) },
      select: { id: true, email: true, name: true, role: true, passwordHash: true, authProvider: true, isActive: true },
    });
    return { user, isNewUser: false };
  }

  invalidatePendingResets(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  }

  createPasswordReset(userId: string, token: string, expiresAt: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      },
    });
  }
}
