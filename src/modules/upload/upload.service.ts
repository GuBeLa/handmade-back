import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseConfig } from '../../config/firebase.config';
import { getStorage } from 'firebase-admin/storage';

@Injectable()
export class UploadService implements OnModuleInit {
  private storage: ReturnType<typeof getStorage> | null = null;

  constructor(
    private configService: ConfigService,
    private firebaseConfig: FirebaseConfig,
  ) {}

  onModuleInit() {
    // Initialize Storage after Firebase is ready
    try {
      this.storage = this.firebaseConfig.getStorage();
      if (!this.storage) {
        console.warn('⚠️ Firebase Storage is not initialized yet. Will retry on first use.');
      } else {
        console.log('✅ UploadService: Storage initialized successfully');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Storage in UploadService onModuleInit:', error.message);
      // Don't throw - will retry on first use
    }
  }

  private getStorageInstance(): ReturnType<typeof getStorage> {
    if (!this.storage) {
      try {
        this.storage = this.firebaseConfig.getStorage();
        if (!this.storage) {
          throw new Error('Firebase Storage is not initialized');
        }
      } catch (error) {
        throw new Error(`Firebase Storage is not initialized. Please check Firebase configuration: ${error.message}`);
      }
    }
    return this.storage;
  }

  async uploadFile(file: Express.Multer.File, folder?: string): Promise<string> {
    return this.uploadToFirebase(file, folder);
  }

  async uploadToFirebase(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<string> {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty');
    }

    const storage = this.getStorageInstance();

    try {
      const bucket = storage.bucket();
      if (!bucket) {
        throw new Error('Failed to get storage bucket. Please check Firebase Storage configuration.');
      }

      // Sanitize filename
      const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${folder || 'uploads'}/${Date.now()}-${sanitizedFileName}`;
      const fileBuffer = file.buffer;

      const fileRef = bucket.file(fileName);
      
      // Upload file
      await fileRef.save(fileBuffer, {
        metadata: {
          contentType: file.mimetype || 'image/jpeg',
          cacheControl: 'public, max-age=31536000',
        },
        public: true,
      });

      // Make file publicly accessible
      try {
        await fileRef.makePublic();
      } catch (makePublicError: any) {
        // If file is already public, ignore the error
        if (!makePublicError.message?.includes('already public')) {
          console.warn('⚠️ Warning: Could not make file public:', makePublicError.message);
        }
      }

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log('✅ File uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('❌ Error uploading file to Firebase Storage:', error);
      
      // Provide more specific error messages
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Failed to connect to Firebase Storage. Please check your network connection.');
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error('Permission denied. Please check Firebase Storage permissions.');
      } else if (error.message?.includes('bucket')) {
        throw new Error('Firebase Storage bucket not found. Please check Firebase configuration.');
      } else {
        throw new Error(`Failed to upload file: ${error.message || 'Unknown error'}`);
      }
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(url: string): Promise<void> {
    const storage = this.getStorageInstance();

    try {
      const bucket = storage.bucket();
      if (!bucket) {
        throw new Error('Failed to get storage bucket. Please check Firebase Storage configuration.');
      }

      // Extract file path from URL
      // Format: https://storage.googleapis.com/bucket-name/path/to/file.jpg
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const bucketName = pathParts[1];
      const filePath = pathParts.slice(2).join('/');
      
      if (filePath) {
        const fileRef = bucket.file(filePath);
        await fileRef.delete();
      }
    } catch (error) {
      console.error('❌ Error deleting file from Firebase Storage:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
}
