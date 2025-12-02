import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseConfig } from '../../config/firebase.config';
import { getStorage } from 'firebase-admin/storage';

@Injectable()
export class UploadService {
  private storage: ReturnType<typeof getStorage>;

  constructor(
    private configService: ConfigService,
    private firebaseConfig: FirebaseConfig,
  ) {
    this.storage = this.firebaseConfig.getStorage();
  }

  async uploadFile(file: Express.Multer.File, folder?: string): Promise<string> {
    return this.uploadToFirebase(file, folder);
  }

  async uploadToFirebase(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<string> {
    const bucket = this.storage.bucket();
    const fileName = `${folder || 'uploads'}/${Date.now()}-${file.originalname}`;
    const fileBuffer = file.buffer;

    const fileRef = bucket.file(fileName);
    
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: file.mimetype,
      },
      public: true,
    });

    // Make file publicly accessible
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return publicUrl;
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(url: string): Promise<void> {
    const bucket = this.storage.bucket();
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
  }
}
