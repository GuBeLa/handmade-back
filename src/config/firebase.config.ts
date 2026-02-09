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
    console.log('🔧 FirebaseConfig.onModuleInit() called');
    try {
      this.initializeFirebase();
      console.log('✅ Firebase initialization completed');
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      throw error;
    }
  }

  private initializeFirebase() {
    console.log('🔧 Starting Firebase initialization...');
    
    // Check if Firebase is already initialized
    if (getApps().length > 0) {
      console.log('📦 Using existing Firebase app');
      this.app = getApps()[0];
    } else {
      console.log('🆕 Creating new Firebase app...');
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
          if (!serviceAccountJson.project_id) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT is missing required field: project_id');
          }
          if (!serviceAccountJson.client_email) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT is missing required field: client_email');
          }
          if (!serviceAccountJson.private_key) {
            throw new Error(
              'FIREBASE_SERVICE_ACCOUNT is missing required field: private_key. ' +
              'Make sure you copied the entire private_key from the Firebase service account JSON file, ' +
              'not the private_key_id. The private_key should start with "-----BEGIN PRIVATE KEY-----"'
            );
          }
          
          // Check if private_key looks like private_key_id (common mistake)
          const privateKeyValue = String(serviceAccountJson.private_key).trim();
          if (privateKeyValue.length < 100 && /^[a-f0-9]+$/i.test(privateKeyValue)) {
            throw new Error(
              `FIREBASE_SERVICE_ACCOUNT appears to have private_key_id instead of private_key. ` +
              `The value "${privateKeyValue}" looks like a key ID (${privateKeyValue.length} chars), not a private key. ` +
              `Please download a fresh service account JSON from Firebase Console and copy the entire private_key field ` +
              `(it should be much longer, ~1600+ characters, and start with "-----BEGIN PRIVATE KEY-----")`
            );
          }
          
          // Fix private key formatting - handle multiple escape scenarios
          if (serviceAccountJson.private_key) {
            let privateKey = String(serviceAccountJson.private_key);
            
            // Replace escaped newlines (\\n -> \n) - handle both single and double escaping
            // Important: Do double-escaped first, then single-escaped
            privateKey = privateKey.replace(/\\\\n/g, '\n'); // Double escaped first
            privateKey = privateKey.replace(/\\n/g, '\n'); // Then single escaped
            
            // Trim whitespace but preserve internal structure
            privateKey = privateKey.trim();
            
            // Check if it's already in valid PEM format (after newline replacement)
            const hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
                                   privateKey.includes('-----BEGIN RSA PRIVATE KEY-----');
            const hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----') || 
                                 privateKey.includes('-----END RSA PRIVATE KEY-----');
            
            // If we have both markers, it should be valid
            if (hasBeginMarker && hasEndMarker) {
              // Key appears to be in correct format, just ensure it's properly formatted
              serviceAccountJson.private_key = privateKey;
            } else if (hasBeginMarker && !hasEndMarker) {
              // Has BEGIN but missing END - add it
              if (privateKey.includes('BEGIN PRIVATE KEY')) {
                privateKey = privateKey + '\n-----END PRIVATE KEY-----';
              } else if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
                privateKey = privateKey + '\n-----END RSA PRIVATE KEY-----';
              }
              serviceAccountJson.private_key = privateKey;
            } else if (!hasBeginMarker && hasEndMarker) {
              // Has END but missing BEGIN - add it
              if (privateKey.includes('END PRIVATE KEY')) {
                privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey;
              } else if (privateKey.includes('END RSA PRIVATE KEY')) {
                privateKey = '-----BEGIN RSA PRIVATE KEY-----\n' + privateKey;
              }
              serviceAccountJson.private_key = privateKey;
            } else {
              // No markers found - check if it might be the key content only
              // Check if it looks like base64 content
              const base64Pattern = /^[A-Za-z0-9+/=\s\n-]+$/;
              const cleanKey = privateKey.replace(/[\s\n-]/g, '');
              
              if (privateKey.length > 100 && base64Pattern.test(privateKey)) {
                // Looks like base64 encoded key without markers - add them
                privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
                serviceAccountJson.private_key = privateKey;
              } else {
                // Debug info for troubleshooting
                const preview = privateKey.substring(0, 100).replace(/\n/g, '\\n');
                throw new Error(
                  `Private key does not appear to be in valid PEM format. ` +
                  `Missing BEGIN/END markers. Preview (first 100 chars): ${preview}... ` +
                  `Length: ${privateKey.length}, Has BEGIN: ${hasBeginMarker}, Has END: ${hasEndMarker}`
                );
              }
            }
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
        console.log('🔑 Using individual Firebase credentials (FIREBASE_PRIVATE_KEY)');
        const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
        const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
        const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
        
        console.log(`   Project ID: ${projectId ? '✅' : '❌'} ${projectId || 'missing'}`);
        console.log(`   Private Key: ${privateKey ? '✅' : '❌'} ${privateKey ? `${privateKey.substring(0, 50)}...` : 'missing'}`);
        console.log(`   Client Email: ${clientEmail ? '✅' : '❌'} ${clientEmail || 'missing'}`);
        
        if (!projectId || !privateKey || !clientEmail) {
          throw new Error(
            'Firebase credentials are not properly configured. ' +
            'Please set either FIREBASE_SERVICE_ACCOUNT (recommended) or ' +
            'FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your .env file.'
          );
        }
        
        // Remove quotes if present (from env file)
        let cleanPrivateKey = privateKey.trim();
        if ((cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) ||
            (cleanPrivateKey.startsWith("'") && cleanPrivateKey.endsWith("'"))) {
          cleanPrivateKey = cleanPrivateKey.slice(1, -1);
        }
        
        // Fix private key formatting - replace escaped newlines
        const formattedPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
        
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
    try {
      this.firestore = getFirestore(this.app);
      this.storage = getStorage(this.app);
      this.auth = getAuth(this.app);
      
      // Validate that services were initialized
      if (!this.firestore) {
        throw new Error('Firestore failed to initialize');
      }
      if (!this.storage) {
        throw new Error('Storage failed to initialize');
      }
      if (!this.auth) {
        throw new Error('Auth failed to initialize');
      }
      
      console.log('✅ Firebase initialized successfully');
      console.log(`   Project: ${this.app.options.projectId || 'unknown'}`);
      console.log(`   Storage Bucket: ${this.app.options.storageBucket || 'unknown'}`);
    } catch (error) {
      console.error('❌ Failed to initialize Firebase services:', error);
      throw new Error(`Failed to initialize Firebase services: ${error.message}`);
    }
  }

  getFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firestore is not initialized. Check Firebase configuration.');
    }
    return this.firestore;
  }

  getStorage(): Storage {
    if (!this.storage) {
      throw new Error('Storage is not initialized. Check Firebase configuration.');
    }
    return this.storage;
  }

  getAuth(): Auth {
    return this.auth;
  }
}

