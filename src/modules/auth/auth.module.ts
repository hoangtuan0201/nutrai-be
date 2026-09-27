import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthService } from '../firebase/firebase-auth.service';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { PasswordResetRequestedHandler } from './events/password-reset-requested.handler';

const EventHandlers = [PasswordResetRequestedHandler];

@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
    CqrsModule, // provides EventBus, CommandBus, QueryBus
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthService, ...EventHandlers],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
