import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma/prisma.module';
import { MealsModule } from './modules/meals/meals.module';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { ProfileModule } from './modules/profile/profile.module';
import { FoodsModule } from './modules/foods/foods.module';
import { AiModule } from './modules/ai/ai.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import configuration from './config/configuration';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import firebaseConfig from './config/firebase.config';
import jwtConfig from './config/jwt.config';
import authConfig from './config/auth.config';
import { validateEnv } from './config/validation.schema';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';
import { ProgressModule } from './modules/progress/progress.module';
import { AccountModule } from './modules/account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configuration, databaseConfig, redisConfig, firebaseConfig, jwtConfig, authConfig],
      validate: validateEnv,
    }),
    PrismaModule,
    FirebaseModule,
    AuthModule,
    MealsModule,
    ProfileModule,
    FoodsModule,
    AiModule,
    AiAssistantModule,
    CloudinaryModule,
    ProgressModule,
    AccountModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
