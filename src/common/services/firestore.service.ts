import { Injectable } from '@nestjs/common';
import { FirebaseConfig } from '../../config/firebase.config';
import { Firestore, CollectionReference, DocumentReference, Query } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

@Injectable()
export class FirestoreService {
  private db: Firestore | null = null;

  constructor(private firebaseConfig: FirebaseConfig) {}

  private getDb(): Firestore {
    // Lazy initialization - get Firestore when first needed
    if (!this.db) {
      try {
        this.db = this.firebaseConfig.getFirestore();
        if (!this.db) {
          throw new Error('Firestore is not initialized. Check Firebase configuration.');
        }
      } catch (error) {
        console.error('❌ Failed to get Firestore instance:', error);
        throw new Error(`Firestore service initialization failed: ${error.message}`);
      }
    }
    return this.db;
  }

  collection(collectionName: string): CollectionReference {
    return this.getDb().collection(collectionName);
  }

  doc(collectionName: string, docId?: string): DocumentReference {
    if (docId) {
      return this.getDb().collection(collectionName).doc(docId);
    }
    return this.getDb().collection(collectionName).doc();
  }

  async create<T = any>(collectionName: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const docRef = this.doc(collectionName);
    const now = Timestamp.now();
    const docData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(docData);
    const saved = await docRef.get();
    return { id: saved.id, ...saved.data() } as T;
  }

  async findById<T = any>(collectionName: string, id: string): Promise<T | null> {
    const docRef = this.doc(collectionName, id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as T;
  }

  async findAll<T = any>(collectionName: string, query?: (ref: CollectionReference) => Query): Promise<T[]> {
    let collectionRef: CollectionReference | Query = this.collection(collectionName);
    if (query) {
      collectionRef = query(this.collection(collectionName));
    }
    const snapshot = await collectionRef.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
  }

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<T> {
    const docRef = this.doc(collectionName, id);
    await docRef.update({
      ...data,
      updatedAt: Timestamp.now(),
    });
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as T;
  }

  async delete(collectionName: string, id: string): Promise<void> {
    const docRef = this.doc(collectionName, id);
    await docRef.delete();
  }

  async findOneBy<T = any>(collectionName: string, field: string, value: any): Promise<T | null> {
    const snapshot = await this.collection(collectionName)
      .where(field, '==', value)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as T;
  }

  async findManyBy<T = any>(collectionName: string, field: string, value: any): Promise<T[]> {
    const snapshot = await this.collection(collectionName)
      .where(field, '==', value)
      .get();
    
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
  }
}

