import { Injectable } from '@nestjs/common';
import { FirebaseConfig } from '../../config/firebase.config';
import { Firestore, CollectionReference, DocumentReference, Query } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

@Injectable()
export class FirestoreService {
  private db: Firestore | null = null;
  /** When true, Firebase/Firestore was checked and is unavailable (e.g. on Vercel without credentials) */
  private unavailable = false;

  constructor(private firebaseConfig: FirebaseConfig) {}

  /** Returns Firestore or null if not configured. Does not throw. */
  getDbOrNull(): Firestore | null {
    if (this.unavailable) return null;
    if (this.db) return this.db;
    try {
      this.db = this.firebaseConfig.getFirestore();
      if (!this.db) this.unavailable = true;
      return this.db;
    } catch (error) {
      this.unavailable = true;
      this.db = null;
      if (!(error as any)._firestoreLogged) {
        (error as any)._firestoreLogged = true;
        console.warn('Firestore not available (Firebase not configured or failed). Subscription/plan reads will return empty.');
      }
      return null;
    }
  }

  isAvailable(): boolean {
    return this.getDbOrNull() !== null;
  }

  private getDb(): Firestore {
    const db = this.getDbOrNull();
    if (!db) {
      throw new Error('Firestore is not initialized. Check Firebase configuration.');
    }
    return db;
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
    if (!this.getDbOrNull()) throw new Error('Firestore is not configured. Cannot create.');
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

  async createWithId<T = any>(collectionName: string, id: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    if (!this.getDbOrNull()) throw new Error('Firestore is not configured. Cannot create.');
    const docRef = this.doc(collectionName, id);
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists) {
      // Document already exists, return it
      return { id: docSnapshot.id, ...docSnapshot.data() } as T;
    }
    
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
    if (!this.getDbOrNull()) return null;
    const docRef = this.doc(collectionName, id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as T;
  }

  async findAll<T = any>(collectionName: string, query?: (ref: CollectionReference) => Query): Promise<T[]> {
    if (!this.getDbOrNull()) return [];
    let collectionRef: CollectionReference | Query = this.collection(collectionName);
    if (query) {
      collectionRef = query(this.collection(collectionName));
    }
    const snapshot = await collectionRef.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
  }

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<T> {
    if (!this.getDbOrNull()) throw new Error('Firestore is not configured. Cannot update.');
    const docRef = this.doc(collectionName, id);
    await docRef.update({
      ...data,
      updatedAt: Timestamp.now(),
    });
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as T;
  }

  async delete(collectionName: string, id: string): Promise<void> {
    if (!this.getDbOrNull()) throw new Error('Firestore is not configured. Cannot delete.');
    const docRef = this.doc(collectionName, id);
    await docRef.delete();
  }

  async findOneBy<T = any>(collectionName: string, field: string, value: any): Promise<T | null> {
    if (!this.getDbOrNull()) return null;
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
    if (!this.getDbOrNull()) return [];
    const snapshot = await this.collection(collectionName)
      .where(field, '==', value)
      .get();
    
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
  }

  async findOneByTwoFields<T = any>(
    collectionName: string,
    field1: string,
    value1: any,
    field2: string,
    value2: any,
  ): Promise<T | null> {
    if (!this.getDbOrNull()) return null;
    const snapshot = await this.collection(collectionName)
      .where(field1, '==', value1)
      .where(field2, '==', value2)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as T;
  }
}

