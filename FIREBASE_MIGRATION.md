# Firebase Migration Guide

## Overview

აპლიკაცია გადაყვანილია Firebase-ზე:
- **Database**: TypeORM/PostgreSQL → Firebase Firestore
- **Storage**: Supabase/AWS/Cloudinary → Firebase Storage
- **Authentication**: Custom JWT → Firebase Auth (optional, can still use custom JWT)

## Key Changes

### Backend

1. **Removed TypeORM dependencies**
   - `@nestjs/typeorm`, `typeorm`, `pg` packages removed
   - All `TypeOrmModule.forFeature()` calls removed
   - All `@InjectRepository()` decorators removed

2. **Added Firebase dependencies**
   - `firebase-admin` for server-side operations
   - `firebase` for client-side (if needed)

3. **New Services**
   - `FirebaseConfig` - Firebase Admin initialization
   - `FirestoreService` - Firestore operations wrapper

4. **Service Changes**
   - All services now use `FirestoreService` instead of TypeORM repositories
   - Data structure changed from SQL relations to Firestore documents

### Frontend

1. **Added Firebase SDK**
   - `@react-native-firebase/app`
   - `@react-native-firebase/auth`
   - `@react-native-firebase/firestore`
   - `@react-native-firebase/storage`
   - `firebase` package

2. **Firebase Configuration**
   - `src/config/firebase.config.ts` - Firebase initialization

### Admin

1. **Added Firebase SDK**
   - `firebase` package
   - `firebase-admin` (if needed for server operations)

2. **Firebase Configuration**
   - `src/config/firebase.config.ts` - Firebase initialization

## Data Structure Changes

### From SQL to NoSQL

**Before (TypeORM/SQL)**:
```typescript
// Relations
user.products // Array of Product entities
product.images // Array of ProductImage entities
order.items // Array of OrderItem entities
```

**After (Firestore/NoSQL)**:
```typescript
// Embedded arrays or subcollections
product.images // Array of image objects
order.items // Array of item objects
// Or use subcollections: orders/{orderId}/items/{itemId}
```

### Collections Structure

- `users` - User documents
- `seller_profiles` - Seller profile documents
- `products` - Product documents (images and variants as arrays)
- `categories` - Category documents
- `orders` - Order documents (items as array)
- `reviews` - Review documents
- `wishlist` - Wishlist documents
- `notifications` - Notification documents
- `chat_messages` - Chat message documents
- `banners` - Banner documents

## Migration Steps

1. **Setup Firebase Project**
   - Create project at https://console.firebase.google.com
   - Enable Firestore, Storage, Authentication
   - Get service account key

2. **Configure Environment**
   - Copy `env.example` to `.env` in each project
   - Fill in Firebase credentials

3. **Install Dependencies**
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend
   cd frontend && npm install
   
   # Admin
   cd admin && npm install
   ```

4. **Run Application**
   - Backend will auto-create collections on first use
   - No migrations needed (Firestore is schema-less)

## Important Notes

- **No Relations**: Firestore doesn't support SQL-style joins
- **Queries**: Limited to single-field indexes (compound indexes can be created)
- **Transactions**: Available but different from SQL transactions
- **Real-time**: Built-in real-time listeners available
- **Offline**: Automatic offline support for mobile apps

## Firestore Indexes

Some queries may require composite indexes. Firebase will prompt you to create them when needed.

Common indexes needed:
- `products`: categoryId + isActive + moderationStatus
- `orders`: buyerId + createdAt
- `reviews`: productId + isVisible + createdAt

Create indexes in Firebase Console → Firestore → Indexes

