import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApp, getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export { getAuth };

/**
 * FirebaseModule — initializes Firebase Admin SDK once (global singleton).
 * Uses the modular firebase-admin v12+ API (named exports, no namespace).
 */
@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: (config: ConfigService): App => {
        // Prevent duplicate init on hot-reload
        if (getApps().length > 0) {
          return getApp();
        }

        const projectId = config.get<string>('firebase.projectId');
        const clientEmail = config.get<string>('firebase.clientEmail');
        const privateKey = config.get<string>('firebase.privateKey');

        if (!projectId) {
          throw new Error(
            'Firebase configuration is incomplete. Set FIREBASE_PROJECT_ID in .env',
          );
        }

        // Use service account if full credentials provided, else use ADC
        if (clientEmail && privateKey) {
          return initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
          });
        }

        return initializeApp({
          projectId,
          credential: applicationDefault(),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_ADMIN'],
})
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);

  onModuleInit() {
    this.logger.log('✅ Firebase Admin SDK initialized');
  }
}
