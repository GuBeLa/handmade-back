import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

@Injectable()
export class FirebaseConfig {
  private app: App | null = null;

  constructor(private configService: ConfigService) {}

  private ensureApp(): App | null {
    if (this.app) {
      return this.app;
    }
    if (getApps().length > 0) {
      this.app = getApps()[0] as App;
      return this.app;
    }
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (serviceAccountJson && serviceAccountJson !== '{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}') {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        if (parsed.private_key) {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        const storageBucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || `${parsed.project_id}.appspot.com`;
        this.app = initializeApp({
          credential: cert(parsed),
          storageBucket,
          projectId: parsed.project_id,
        });
        return this.app;
      } catch (e) {
        console.warn('FirebaseConfig: Failed to init from FIREBASE_SERVICE_ACCOUNT:', (e as Error).message);
        return null;
      }
    }
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    if (!projectId || !privateKey || !clientEmail) {
      return null;
    }
    try {
      const formattedKey = privateKey.replace(/\\n/g, '\n');
      const storageBucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || `${projectId}.appspot.com`;
      this.app = initializeApp({
        credential: cert({ projectId, privateKey: formattedKey, clientEmail }),
        storageBucket,
      });
      return this.app;
    } catch (e) {
      console.warn('FirebaseConfig: Failed to init from env:', (e as Error).message);
      return null;
    }
  }

  getFirestore(): Firestore | null {
    const app = this.ensureApp();
    return app ? getFirestore(app) : null;
  }

  getStorage(): ReturnType<typeof getStorage> | null {
    const app = this.ensureApp();
    return app ? getStorage(app) : null;
  }
}
