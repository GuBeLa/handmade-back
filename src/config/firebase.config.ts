import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseConfig implements OnModuleInit {
  private app: App;
  public firestore: Firestore;
  public storage: Storage;
  public auth: Auth;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    // Check if Firebase is already initialized
    if (getApps().length > 0) {
      this.app = getApps()[0];
    } else {
      // Initialize Firebase Admin
      const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
      
      if (serviceAccount && serviceAccount !== '{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}') {
        try {
          // Use service account JSON (recommended for production)
          let serviceAccountJson: any;
          
          // Try to parse as JSON string first
          try {
            serviceAccountJson = typeof serviceAccount === 'string' 
              ? JSON.parse(serviceAccount) 
              : serviceAccount;
          } catch (parseError) {
            throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON: ${parseError.message}`);
          }
          
          // Validate required fields
          if (!serviceAccountJson.project_id || !serviceAccountJson.private_key || !serviceAccountJson.client_email) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT is missing required fields (project_id, private_key, client_email)');
          }
          
          // Fix private key formatting - handle multiple escape scenarios
          if (serviceAccountJson.private_key) {
            let privateKey = serviceAccountJson.private_key;
            
            // Replace escaped newlines (\\n -> \n)
            privateKey = privateKey.replace(/\\n/g, '\n');
            
            // Replace literal \n strings (if double-escaped)
            privateKey = privateKey.replace(/\\\\n/g, '\n');
            
            // Ensure proper PEM format
            if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY')) {
              // Try to reconstruct if it's missing headers
              if (privateKey.includes('PRIVATE KEY')) {
                // Key exists but might be missing BEGIN/END markers
                if (!privateKey.trim().startsWith('-----BEGIN')) {
                  privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey.trim()}\n-----END PRIVATE KEY-----`;
                }
              } else {
                throw new Error('Private key does not appear to be in valid PEM format');
              }
            }
            
            // Ensure END marker exists
            if (!privateKey.includes('END PRIVATE KEY') && !privateKey.includes('END RSA PRIVATE KEY')) {
              if (privateKey.includes('BEGIN PRIVATE KEY')) {
                privateKey = privateKey.trim() + '\n-----END PRIVATE KEY-----';
              } else if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
                privateKey = privateKey.trim() + '\n-----END RSA PRIVATE KEY-----';
              }
            }
            
            serviceAccountJson.private_key = privateKey;
          }
          
          this.app = initializeApp({
            credential: cert(serviceAccountJson),
            storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || `${serviceAccountJson.project_id}.appspot.com`,
            projectId: serviceAccountJson.project_id,
          });
        } catch (error) {
          throw new Error(`Failed to initialize Firebase with service account: ${error.message}`);
        }
      } else {
        // Use individual credentials
        const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
        const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
        const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
        
        if (!projectId || !privateKey || !clientEmail) {
          throw new Error(
            'Firebase credentials are not properly configured. ' +
            'Please set either FIREBASE_SERVICE_ACCOUNT (recommended) or ' +
            'FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your .env file.'
          );
        }
        
        // Fix private key formatting - replace escaped newlines
        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
        
        // Validate private key format
        if (!formattedPrivateKey.includes('BEGIN PRIVATE KEY') && !formattedPrivateKey.includes('BEGIN RSA PRIVATE KEY')) {
          throw new Error('FIREBASE_PRIVATE_KEY does not appear to be in valid PEM format');
        }
        
        try {
          this.app = initializeApp({
            credential: cert({
              projectId,
              privateKey: formattedPrivateKey,
              clientEmail,
            }),
            storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || `${projectId}.appspot.com`,
          });
        } catch (error) {
          throw new Error(`Failed to initialize Firebase with individual credentials: ${error.message}`);
        }
      }
    }

    // Initialize services
    this.firestore = getFirestore(this.app);
    this.storage = getStorage(this.app);
    this.auth = getAuth(this.app);
  }

  getFirestore(): Firestore {
    return this.firestore;
  }

  getStorage(): Storage {
    return this.storage;
  }

  getAuth(): Auth {
    return this.auth;
  }
}

