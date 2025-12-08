# Database Seeding Guide

## 🌱 Seed Scripts

შექმნილია 3 seed script:

1. **`seed:users`** - იუზერების seeding
2. **`seed:products`** - პროდუქტების seeding
3. **`seed:all`** - ყველაფრის seeding (users + products)

## ✅ Idempotent (Safe to Run Multiple Times)

ყველა seed script **idempotent**-ია - რამდენჯერაც არ უნდა გაეშვას, არ შექმნის duplicates:

- ✅ ამოწმებს არსებულ records-ს
- ✅ Skip-ს აკეთებს თუ უკვე არსებობს
- ✅ Update-ს აკეთებს თუ საჭიროა
- ✅ არ შექმნის duplicates

## 🚀 გამოყენება:

### Option 1: Seed Everything (რეკომენდებული)

```bash
cd backend
npm run seed:all
```

ეს გააკეთებს:
1. Users seeding
2. Products seeding

### Option 2: Seed Separately

```bash
# Seed only users
npm run seed:users

# Seed only products (requires users to exist)
npm run seed:products
```

## 📝 რა იწერება:

### Users (6 users):
- **2 Buyers**: buyer1@test.com, buyer2@test.com
- **2 Sellers**: seller1@test.com, seller2@test.com
- **1 Admin**: admin@test.com
- **1 Moderator**: moderator@test.com

**Password:** `password123` (buyers/sellers), `admin123` (admin), `mod123` (moderator)

### Products (10 products):
- Jewelry (2 products)
- Home Decor (2 products)
- Clothing (2 products)
- Accessories (2 products)
- Art & Crafts (2 products)

ყველა product:
- ✅ Auto-approved (moderationStatus: APPROVED)
- ✅ Active (isActive: true)
- ✅ Has placeholder images
- ✅ Distributed among sellers

### Categories:
- Auto-created თუ არ არსებობს
- Categories: Jewelry, Home Decor, Clothing, Accessories, Art & Crafts

## 🔄 Update Logic:

### Users:
- თუ user არსებობს, ამოწმებს:
  - Role matches?
  - firstName/lastName set?
  - isActive = true?
- თუ რამე განსხვავებულია, update-ს აკეთებს

### Products:
- თუ product არსებობს (same title + sellerId), ამოწმებს:
  - Stock matches?
  - Price matches?
  - isActive = true?
  - moderationStatus = APPROVED?
- თუ რამე განსხვავებულია, update-ს აკეთებს

### Categories:
- თუ category არსებობს, ამოწმებს:
  - isActive = true?
- თუ inactive-ია, reactivate-ს აკეთებს

## ✅ Success Output:

```
🌱 Starting full database seeding...

📝 Step 1: Seeding users...
✅ Created user: buyer1@test.com (buyer)
✅ Created user: seller1@test.com (seller)
...

📦 Step 2: Seeding products...
✅ Created product: "Handmade Silver Necklace" (Jewelry)
...

✨ Full database seeding completed successfully!
```

## ⚠️ მნიშვნელოვანი:

1. **Firebase credentials** უნდა იყოს დაყენებული `.env` ფაილში
2. **Firestore API** უნდა იყოს enabled Firebase Console-ში
3. Scripts **idempotent**-ებია - safe to run multiple times

## 🐛 Troubleshooting:

### Error: "Firebase credentials are not properly configured"
- შეამოწმეთ `.env` ფაილი
- დარწმუნდით რომ `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` დაყენებულია

### Error: "No seller users found"
- ჯერ გაუშვით `npm run seed:users`
- შემდეგ `npm run seed:products`

### Error: "PERMISSION_DENIED"
- შეამოწმეთ Firestore API enabled-ია Firebase Console-ში
- იხილეთ: `backend/FIREBASE_API_SETUP.md`

---

**🎯 Tip:** გამოიყენეთ `npm run seed:all` რომ ყველაფერი ერთად დაიწეროს!

