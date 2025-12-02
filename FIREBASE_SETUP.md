# Firebase Setup Guide

## 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter project name: `handmade-marketplace`
4. Enable Google Analytics (optional)
5. Click "Create project"
6. Wait for project creation

## 2. Enable Firebase Services

### Firestore Database
1. Go to **Firestore Database** in left sidebar
2. Click **Create database**
3. Start in **production mode** (we'll add security rules later)
4. Choose location (closest to your users)
5. Click **Enable**

### Firebase Storage
1. Go to **Storage** in left sidebar
2. Click **Get started**
3. Start in **production mode**
4. Use same location as Firestore
5. Click **Done**

### Firebase Authentication
1. Go to **Authentication** in left sidebar
2. Click **Get started**
3. Enable sign-in methods:
   - **Email/Password**: Enable
   - **Phone**: Enable (for SMS verification)
   - **Google**: Enable (add OAuth credentials)
   - **Facebook**: Enable (add OAuth credentials)
   - **Apple**: Enable (add OAuth credentials)

## 3. Get Service Account Key (Backend)

1. Go to **Project Settings** (gear icon) → **Service Accounts**
2. Click **Generate new private key**
3. Download JSON file
4. Add to `backend/.env` as `FIREBASE_SERVICE_ACCOUNT` (paste entire JSON as string)

Or use individual credentials:
- Copy **Project ID**
- Copy **Private key** (from JSON)
- Copy **Client email** (from JSON)

## 4. Get Web Configuration (Frontend/Admin)

1. Go to **Project Settings** → **General**
2. Scroll to **Your apps** section
3. Click **Web** icon (`</>`)
4. Register app name
5. Copy configuration:
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

## 5. Configure Environment Variables

### Backend (`backend/.env`)
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

### Frontend (`frontend/.env`)
```env
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
```

### Admin (`admin/.env`)
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## 6. Firestore Security Rules

Go to **Firestore Database** → **Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Products - public read, seller write
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && 
        resource.data.sellerId == request.auth.uid;
    }
    
    // Orders - buyer and seller can access
    match /orders/{orderId} {
      allow read, write: if request.auth != null && 
        (resource.data.buyerId == request.auth.uid || 
         get(/databases/$(database)/documents/products/$(resource.data.productId)).data.sellerId == request.auth.uid);
    }
    
    // Add more rules as needed
  }
}
```

## 7. Storage Security Rules

Go to **Storage** → **Rules**:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 8. Install Dependencies

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

### Admin
```bash
cd admin
npm install
```

## 9. Initialize Firebase in Code

### Backend
Firebase is automatically initialized via `FirebaseConfig` service.

### Frontend
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

## 10. Data Migration from TypeORM to Firestore

### Collections Structure

- `users` - User documents
- `seller_profiles` - Seller profile documents
- `products` - Product documents
- `categories` - Category documents
- `orders` - Order documents
- `order_items` - Order item subcollections
- `reviews` - Review documents
- `wishlist` - Wishlist documents
- `notifications` - Notification documents
- `chat_messages` - Chat message documents
- `banners` - Banner documents

### Example Document Structure

```typescript
// users/{userId}
{
  id: "user-id",
  email: "user@example.com",
  phone: "+995123456789",
  firstName: "John",
  lastName: "Doe",
  role: "buyer",
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// products/{productId}
{
  id: "product-id",
  title: "Product Title",
  price: 100,
  sellerId: "seller-id",
  categoryId: "category-id",
  images: ["url1", "url2"],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 11. Testing

1. Start backend: `npm run start:dev`
2. Test Firestore connection
3. Test Storage upload
4. Test Authentication

## Notes

- Firestore is NoSQL - different from SQL/TypeORM
- Use subcollections for related data (e.g., order_items under orders)
- Indexes may be needed for complex queries
- Real-time listeners available for live updates
- Offline support built-in for mobile apps

