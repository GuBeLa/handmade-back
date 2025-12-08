# Firestore Indexes Setup

## ⚠️ პრობლემა:

Firestore composite queries (where + orderBy) საჭიროებს indexes. Error message:
```
9 FAILED_PRECONDITION: The query requires an index.
```

## ✅ გადაწყვეტა:

### Option 1: Firebase Console-ში (რეკომენდებული)

1. გადადით error message-ში მოცემულ link-ზე:
   ```
   https://console.firebase.google.com/v1/r/project/handmade-backend-1debc/firestore/indexes?create_composite=...
   ```

2. Firebase ავტომატურად შექმნის საჭირო index-ს

3. დაელოდეთ რომ index build დასრულდეს (2-5 წუთი)

### Option 2: Firebase CLI-ით

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase (თუ არ გაქვთ firebase.json):**
   ```bash
   cd backend
   firebase init firestore
   ```

4. **Deploy indexes:**
   ```bash
   firebase deploy --only firestore:indexes
   ```

### Option 3: Client-side Sorting (დროებითი გადაწყვეტა)

Categories service-ში უკვე განახლებულია რომ client-side-ზე აკეთებს filtering და sorting, ასე რომ index არ არის საჭირო.

## 📝 Indexes List:

შევქმენი `firestore.indexes.json` ფაილი რომელიც შეიცავს ყველა საჭირო index-ს:

- **categories**: `isActive` + `sortOrder`
- **categories**: `parentId` + `isActive` + `sortOrder`
- **orders**: `buyerId` + `createdAt`
- **reviews**: `productId` + `isVisible` + `createdAt`
- **chat_messages**: `orderId` + `createdAt`
- **wishlist**: `userId` + `createdAt`
- **products**: `sellerId` + `createdAt`
- **banners**: `isActive` + `sortOrder`
- **notifications**: `userId` + `createdAt`

## 🚀 Quick Fix (Categories):

Categories-ისთვის უკვე განახლებულია რომ client-side sorting-ს იყენებს, ასე რომ:
- ✅ `GET /api/categories` ახლა მუშაობს index-ის გარეშე
- ⚠️ სხვა endpoints-ებისთვის შეიძლება დაგჭირდეთ indexes

## 📋 Checklist:

- [ ] Categories endpoint მუშაობს (უკვე გასწორებულია)
- [ ] Orders endpoint - შეიძლება დაგჭირდეთ index
- [ ] Reviews endpoint - შეიძლება დაგჭირდეთ index
- [ ] Chat messages - შეიძლება დაგჭირდეთ index
- [ ] Wishlist - შეიძლება დაგჭირდეთ index

---

**💡 Tip:** Firebase Console-ში error message-ში მოცემული link-ზე გადასვლით ავტომატურად შეიქმნება საჭირო index!

