import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthService } from '../firebase/firebase-auth.service';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
    // JwtModule configured async so it reads JWT_SECRET from ConfigService
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
  providers: [AuthService, FirebaseAuthService],
  // Export AuthService so other modules can use token validation if needed
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
