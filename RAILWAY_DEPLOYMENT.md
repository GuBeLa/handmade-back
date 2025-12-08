# Railway-ზე Deployment - Step by Step

ეს არის ყველაზე მარტივი გზა backend-ის deployment-ისთვის.

## 📋 წინაპირობები

1. ✅ GitHub repository-ში გაქვთ backend კოდი
2. ✅ Firebase credentials მზადაა
3. ✅ Environment variables ცნობილია

## 🚀 Step-by-Step ინსტრუქციები

### Step 1: Railway Account-ის შექმნა

1. გადადით: **https://railway.app**
2. Click **"Start a New Project"** ან **"Login"**
3. აირჩიეთ **"Login with GitHub"**
4. დაამტკიცეთ GitHub-ის access

### Step 2: ახალი Project-ის შექმნა

1. Railway dashboard-ში click **"New Project"**
2. აირჩიეთ **"Deploy from GitHub repo"**
3. თუ პირველად იყენებთ, დაამტკიცეთ GitHub repository access
4. აირჩიეთ თქვენი repository: `handmadeApp` (ან როგორც გაქვთ)
5. Railway დაიწყებს repository-ის scan-ს

### Step 3: Service-ის კონფიგურაცია

1. Railway ავტომატურად გაიგებს რომ ეს Node.js პროექტია
2. **Root Directory** დააყენეთ: `backend`
   - Settings → Source → Root Directory → `backend`
3. **Build Command:** `npm install && npm run build`
   - Settings → Build → Build Command
4. **Start Command:** `npm run start:prod`
   - Settings → Deploy → Start Command

### Step 4: Environment Variables-ის დამატება

1. Project-ში გადადით **"Variables"** tab-ზე
2. დაამატეთ შემდეგი variables:

```env
# Application
NODE_ENV=production
PORT=3005

# Frontend URLs (განაახლეთ თქვენი domains-ით)
FRONTEND_URL=https://your-frontend-domain.com
ADMIN_URL=https://your-admin-domain.com

# JWT (შექმენით ძლიერი secret!)
JWT_SECRET=your-very-strong-secret-key-minimum-32-characters-long-change-this
JWT_EXPIRES_IN=7d

# Firebase - Service Account JSON (მთელი JSON ერთ ხაზზე!)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"}

# Firebase - Project ID
FIREBASE_PROJECT_ID=your-project-id

# Firebase - Storage Bucket
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Payment Gateways (თუ გაქვთ)
TBC_PAY_MERCHANT_ID=your-merchant-id
TBC_PAY_SECRET_KEY=your-secret-key
LIBERTY_PAY_MERCHANT_ID=your-merchant-id
LIBERTY_PAY_SECRET_KEY=your-secret-key
BOG_PAY_MERCHANT_ID=your-merchant-id
BOG_PAY_SECRET_KEY=your-secret-key

# Business
DEFAULT_COMMISSION_PERCENTAGE=10
```

**⚠️ მნიშვნელოვანი:**
- `FIREBASE_SERVICE_ACCOUNT` უნდა იყოს **მთელი JSON ერთ ხაზზე** (no line breaks)
- `JWT_SECRET` უნდა იყოს **მინიმუმ 32 სიმბოლო** და **ძლიერი**
- `FRONTEND_URL` და `ADMIN_URL` განაახლეთ როცა frontend-ს დეპლოი გაქვთ

### Step 5: Deployment

1. Railway ავტომატურად დაიწყებს deployment-ს
2. შეგიძლიათ ნახოთ logs **"Deployments"** tab-ში
3. დაელოდეთ რომ deployment დასრულდეს (2-5 წუთი)

### Step 6: Domain-ის მიღება

1. Deployment-ის შემდეგ Railway მოგცემთ URL-ს:
   ```
   https://your-app-name.up.railway.app
   ```
2. ან შეგიძლიათ დაამატოთ custom domain:
   - Settings → Networking → Custom Domain
   - დაამატეთ თქვენი domain (მაგ: `api.handmade-marketplace.ge`)

### Step 7: API-ის ტესტირება

1. გადადით: `https://your-app-name.up.railway.app/api`
2. უნდა მიიღოთ response (მაგ: `{"message":"Hello World"}`)
3. Swagger docs: `https://your-app-name.up.railway.app/api/docs` (მხოლოდ development-ში)

## 🔧 Railway Settings-ის დეტალები

### Build Settings:
```
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm run start:prod
```

### Health Check (optional):
Railway ავტომატურად ამოწმებს health-ს, მაგრამ შეგიძლიათ დაამატოთ:
- Settings → Healthcheck Path: `/api`

## 📝 Frontend-ის განახლება

Deployment-ის შემდეგ განაახლეთ frontend-ის `app.json`:

```json
{
  "extra": {
    "apiBaseUrl": "https://your-app-name.up.railway.app/api"
  }
}
```

ან environment variable-ში:
```env
API_BASE_URL=https://your-app-name.up.railway.app/api
```

## 🐛 Troubleshooting

### Issue: "Build failed"
- **Check:** Root Directory სწორად არის დაყენებული (`backend`)
- **Check:** `package.json` არსებობს `backend` folder-ში
- **Check:** Build logs Railway-ში

### Issue: "Application crashed"
- **Check:** Environment variables სწორად არის დაყენებული
- **Check:** `JWT_SECRET` არ არის default მნიშვნელობა
- **Check:** `FIREBASE_SERVICE_ACCOUNT` სწორად არის ფორმატირებული
- **Check:** Logs Railway-ში (Deployments → View Logs)

### Issue: "Cannot connect to Firebase"
- **Check:** `FIREBASE_SERVICE_ACCOUNT` JSON სწორად არის ფორმატირებული
- **Check:** `FIREBASE_PROJECT_ID` სწორად არის დაყენებული
- **Check:** Firestore API enabled-ია Firebase Console-ში

### Issue: "CORS error"
- **Check:** `FRONTEND_URL` სწორად არის დაყენებული
- **Check:** Frontend-ის URL ემთხვევა `FRONTEND_URL`-ს

## 💰 ფასი

- **Free Tier:** $5 credit/თვეში
- **Pay-as-you-go:** $0.000463/GB RAM/საათი
- **ჩვეულებრივი backend:** ~$5-10/თვე

## 📚 დამატებითი რესურსები

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

## ✅ Checklist

- [ ] Railway account შექმნილია
- [ ] GitHub repository connected-ია
- [ ] Root Directory: `backend`
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm run start:prod`
- [ ] Environment variables დამატებულია
- [ ] `JWT_SECRET` შეცვლილია
- [ ] `FIREBASE_SERVICE_ACCOUNT` დამატებულია
- [ ] Deployment წარმატებით დასრულდა
- [ ] API მუშაობს (`/api` endpoint)
- [ ] Frontend-ის `apiBaseUrl` განახლებულია

---

**🎉 გილოცავთ! თქვენი backend ახლა live-შია!**

