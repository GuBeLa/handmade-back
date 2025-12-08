# Railway-ზე JWT_SECRET-ის დაყენება

## ⚠️ პრობლემა:

Railway-ზე deployment-ისას გამოდის შეცდომა:
```
JWT_SECRET is not properly configured. Please set a secure JWT_SECRET in your .env file.
```

ეს ხდება იმიტომ, რომ Railway-ზე environment variables უნდა დაყენდეს **manually** platform-ის settings-ში.

## ✅ გადაწყვეტა:

### Step 1: გადადით Railway Dashboard-ზე

1. გადადით: https://railway.app
2. აირჩიეთ თქვენი project
3. აირჩიეთ თქვენი service (backend)

### Step 2: გახსენით Variables Tab

1. Click **"Variables"** tab (მარცხენა მენიუში)
2. ან Settings → Variables

### Step 3: დაამატეთ JWT_SECRET

1. Click **"+ New Variable"** ან **"Add Variable"**
2. **Name:** `JWT_SECRET`
3. **Value:** 
   ```
   12080f221149790dbadc478e4be7836bd8b09da6d2d17c687d896758a19a905d96de419913d9770ba2504a5e09f115a4295b5a6b1f0f41018d17e28e6e1ce96b
   ```
4. Click **"Add"** ან **"Save"**

### Step 4: დაამატეთ სხვა Required Variables

დარწმუნდით რომ გაქვთ ეს variables:

#### Application:
- `NODE_ENV` = `production`
- `PORT` = `3005`

#### Authentication:
- `JWT_SECRET` = `12080f221149790dbadc478e4be7836bd8b09da6d2d17c687d896758a19a905d96de419913d9770ba2504a5e09f115a4295b5a6b1f0f41018d17e28e6e1ce96b`
- `JWT_EXPIRES_IN` = `7d`

#### Firebase:
- `FIREBASE_PROJECT_ID` = `handmade-backend-1debc`
- `FIREBASE_SERVICE_ACCOUNT` = `{"type":"service_account","project_id":"handmade-backend-1debc",...}` (მთელი JSON ერთ ხაზზე!)
- `FIREBASE_STORAGE_BUCKET` = `handmade-backend-1debc.firebasestorage.app`

#### Frontend URLs:
- `FRONTEND_URL` = `https://your-frontend-domain.com` (ან `http://localhost:3006` თუ development-ში ხართ)
- `ADMIN_URL` = `https://your-admin-domain.com` (ან `http://localhost:3007`)

### Step 5: Redeploy

1. Railway ავტომატურად გააკეთებს **redeploy**-ს როცა environment variables შეცვლით
2. ან manually: Deployments → "Redeploy"

### Step 6: შემოწმება

1. გადადით **"Deployments"** tab-ზე
2. ნახეთ logs - აღარ უნდა იყოს JWT_SECRET-ის შეცდომა
3. გადადით API URL-ზე: `https://your-app.up.railway.app/api`

## 📝 სრული Environment Variables List:

თუ გსურთ copy-paste, აიღეთ `backend/env` ფაილიდან და დაამატეთ Railway-ზე:

```env
NODE_ENV=production
PORT=3005
JWT_SECRET=12080f221149790dbadc478e4be7836bd8b09da6d2d17c687d896758a19a905d96de419913d9770ba2504a5e09f115a4295b5a6b1f0f41018d17e28e6e1ce96b
JWT_EXPIRES_IN=7d
FIREBASE_PROJECT_ID=handmade-backend-1debc
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"handmade-backend-1debc","private_key":"428c3bc41c971e98330a09efd99d3459926fdc10","client_email":"firebase-adminsdk-fbsvc@handmade-backend-1debc.iam.gserviceaccount.com"}
FIREBASE_STORAGE_BUCKET=handmade-backend-1debc.firebasestorage.app
FRONTEND_URL=https://your-frontend-domain.com
ADMIN_URL=https://your-admin-domain.com
```

## 🔍 როგორ შევამოწმოთ რომ Variables დაყენებულია:

1. Railway Dashboard → Your Service → Variables
2. უნდა ნახოთ ყველა variable list-ში
3. თუ რომელიმე აკლია, დაამატეთ

## ⚠️ მნიშვნელოვანი:

- **FIREBASE_SERVICE_ACCOUNT** უნდა იყოს **მთელი JSON ერთ ხაზზე** (no line breaks, no spaces)
- **JWT_SECRET** უნდა იყოს **მინიმუმ 32 სიმბოლო** (ჩვენი არის 128)
- Railway ავტომატურად გააკეთებს redeploy-ს როცა variables შეცვლით

## 🐛 თუ კვლავ არის პრობლემა:

1. შეამოწმეთ რომ variable-ის **Name** სწორად არის დაწერილი (case-sensitive!)
2. შეამოწმეთ რომ **Value** არ აქვს extra spaces ან line breaks
3. ნახეთ **Deployments** → **Logs** რომ ნახოთ რა შეცდომაა
4. გააკეთეთ **Redeploy** manually

## ✅ Success Checklist:

- [ ] Railway Dashboard-ში გადავედი
- [ ] Variables tab გავხსენი
- [ ] JWT_SECRET დავამატე
- [ ] სხვა required variables დავამატე
- [ ] Redeploy გავაკეთე
- [ ] Logs შევამოწმე - აღარ არის შეცდომა
- [ ] API მუშაობს (`/api` endpoint)

---

**🎉 როცა ყველაფერი დაყენდება, backend იმუშავებს Railway-ზე!**

