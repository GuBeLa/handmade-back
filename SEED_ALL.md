# Database Seeding Guide

## 🌱 Seed Scripts

შექმნილია 4 seed script:

1. **`seed:users`** - იუზერების seeding
2. **`seed:products`** - პროდუქტების seeding
3. **`seed:all`** - ყველაფრის seeding (users + products)
4. **`seed:comprehensive`** - ⭐ **ახალი!** სრული მონაცემების seeding (წაშლის არსებულ მონაცემებს და შექმნის ახალს)

## ✅ Idempotent (Safe to Run Multiple Times)

ყველა seed script **idempotent**-ია - რამდენჯერაც არ უნდა გაეშვას, არ შექმნის duplicates:

- ✅ ამოწმებს არსებულ records-ს
- ✅ Skip-ს აკეთებს თუ უკვე არსებობს
- ✅ Update-ს აკეთებს თუ საჭიროა
- ✅ არ შექმნის duplicates

## 🚀 გამოყენება:

### Option 1: Comprehensive Seeding (რეკომენდებული - ახალი!)

```bash
cd backend
npm run seed:comprehensive
```

ეს გააკეთებს:
1. 🗑️ წაშლის არსებულ მონაცემებს (products, categories, users, seller profiles)
2. 👥 შექმნის 8 იუზერს (3 buyers, 5 sellers სრული პროფილებით, 1 admin)
3. 📁 შექმნის 10 კატეგორიას ფოტოებით
4. 📦 შექმნის 20+ პროდუქტს ფოტოებით

### Option 2: Seed Everything (idempotent - არ წაშლის არსებულ მონაცემებს)

```bash
cd backend
npm run seed:all
```

ეს გააკეთებს:
1. Users seeding
2. Products seeding

### Option 3: Seed Separately

```bash
# Seed only users
npm run seed:users

# Seed only products (requires users to exist)
npm run seed:products
```

## 📝 რა იწერება:

### Comprehensive Seeding (`seed:comprehensive`):

#### Users (8 users):
- **3 Buyers**: buyer1@test.com, buyer2@test.com, buyer3@test.com
- **5 Sellers** სრული პროფილებით:
  - seller1@test.com - ანას ხელნაკეთი ნაწარმი (სამკაულები)
  - seller2@test.com - დავითის ხელნაკეთი ტანსაცმელი
  - seller3@test.com - თამარის ხელნაკეთი სახლის დეკორი
  - seller4@test.com - ლუკას ხელნაკეთი ხის ნაწარმი
  - seller5@test.com - სოფიოს ხელნაკეთი ქსოვილი
- **1 Admin**: admin@test.com

**Password:** `password123` (buyers/sellers), `admin123` (admin)

**Seller Profiles Include:**
- ✅ Shop name and description
- ✅ Address with coordinates (latitude/longitude)
- ✅ Cover photo and profile picture
- ✅ Working hours for each day
- ✅ Followers, ratings, sales data

#### Categories (10 categories):
- სამკაულები (Jewelry)
- სახლის დეკორი (Home Decor)
- ტანსაცმელი (Clothing)
- აქსესუარები (Accessories)
- ხელოვნება და ხელნაკეთი (Art & Crafts)
- ქსოვილი (Textiles)
- ხის ნაწარმი (Woodwork)
- კერამიკა (Ceramics)
- წიგნები და ბარათები (Books & Cards)
- საბავშვო ნივთები (Kids Items)

ყველა category:
- ✅ Has icon and image
- ✅ Georgian and English names
- ✅ Active status

#### Products (20+ products):
- სამკაულები (4 products) - Seller 1
- ტანსაცმელი (4 products) - Seller 2
- სახლის დეკორი (4 products) - Seller 3
- ხის ნაწარმი (3 products) - Seller 4
- ქსოვილი (2 products) - Seller 5
- აქსესუარები (2 products)
- კერამიკა (1 product)
- წიგნები და ბარათები (1 product)
- საბავშვო ნივთები (1 product)

ყველა product:
- ✅ Auto-approved (moderationStatus: APPROVED)
- ✅ Active (isActive: true)
- ✅ Has multiple high-quality images
- ✅ Georgian and English descriptions
- ✅ Realistic ratings and reviews
- ✅ Variants (sizes, colors) where applicable
- ✅ Distributed among sellers

### Standard Seeding (`seed:all`):

#### Users (6 users):
- **2 Buyers**: buyer1@test.com, buyer2@test.com
- **2 Sellers**: seller1@test.com, seller2@test.com
- **1 Admin**: admin@test.com
- **1 Moderator**: moderator@test.com

**Password:** `password123` (buyers/sellers), `admin123` (admin), `mod123` (moderator)

#### Products (10 products):
- Jewelry (2 products)
- Home Decor (2 products)
- Clothing (2 products)
- Accessories (2 products)
- Art & Crafts (2 products)

#### Categories:
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

**🎯 Tip:** გამოიყენეთ `npm run seed:comprehensive` რომ სრულად შევსებული მონაცემები შეიქმნას! 

**⚠️ Warning:** `seed:comprehensive` წაშლის არსებულ მონაცემებს. თუ გსურთ idempotent seeding (არ წაშლის არსებულ მონაცემებს), გამოიყენეთ `npm run seed:all`.

