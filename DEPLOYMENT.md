# Backend Deployment Guide

ეს გაიდი გეხმარებათ NestJS backend-ის deployment-ში სხვადასხვა პლატფორმაზე.

## 📋 მოთხოვნები

სანამ deployment-ს დაიწყებთ, დარწმუნდით რომ:

1. ✅ **Firebase credentials** კონფიგურირებულია
2. ✅ **Environment variables** მზადაა production-ისთვის
3. ✅ **JWT_SECRET** შეცვლილია (არ გამოიყენოთ default მნიშვნელობა)
4. ✅ **CORS** კონფიგურირებულია frontend URL-ებისთვის

## 🚀 რეკომენდებული პლატფორმები

### 1. Railway (რეკომენდებული - ყველაზე მარტივი)

**პლიუსები:**
- ✅ უფასო tier (შეზღუდული)
- ✅ ავტომატური deployment Git-დან
- ✅ Environment variables UI
- ✅ HTTPS ავტომატურად
- ✅ ძალიან მარტივი setup

**Deployment Steps:**

1. **შექმენით Railway account:**
   - გადადით: https://railway.app
   - Sign up GitHub-ით

2. **შექმენით ახალი project:**
   - Click "New Project"
   - აირჩიეთ "Deploy from GitHub repo"
   - აირჩიეთ თქვენი repository

3. **კონფიგურაცია:**
   - Railway ავტომატურად გაიგებს რომ ეს NestJS პროექტია
   - დაამატეთ environment variables:
     ```
     PORT=3005
     NODE_ENV=production
     JWT_SECRET=your-strong-secret-key-min-32-chars
     FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
     FIREBASE_PROJECT_ID=your-project-id
     FIREBASE_STORAGE_BUCKET=your-project.appspot.com
     FRONTEND_URL=https://your-frontend-domain.com
     ADMIN_URL=https://your-admin-domain.com
     TWILIO_ACCOUNT_SID=your-sid
     TWILIO_AUTH_TOKEN=your-token
     TWILIO_PHONE_NUMBER=+1234567890
     ```

4. **Build Settings:**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Root Directory: `backend`

5. **Deploy:**
   - Railway ავტომატურად გააკეთებს deployment-ს
   - მიიღებთ URL-ს: `https://your-app.railway.app`

**ფასი:** უფასო tier: $5 credit/თვეში, შემდეგ pay-as-you-go

---

### 2. Render

**პლიუსები:**
- ✅ უფასო tier (შეზღუდული)
- ✅ ავტომატური deployment
- ✅ HTTPS ავტომატურად
- ✅ მარტივი setup

**Deployment Steps:**

1. **შექმენით Render account:**
   - გადადით: https://render.com
   - Sign up GitHub-ით

2. **შექმენით Web Service:**
   - Click "New +" → "Web Service"
   - აირჩიეთ თქვენი repository
   - Root Directory: `backend`

3. **Build & Start Commands:**
   ```
   Build Command: npm install && npm run build
   Start Command: npm run start:prod
   ```

4. **Environment Variables:**
   - დაამატეთ ყველა environment variable Settings-ში

5. **Deploy:**
   - Render ავტომატურად გააკეთებს deployment-ს
   - მიიღებთ URL-ს: `https://your-app.onrender.com`

**ფასი:** უფასო tier: 750 საათი/თვეში, შემდეგ $7/თვე

---

### 3. DigitalOcean App Platform

**პლიუსები:**
- ✅ ძალიან საიმედო
- ✅ კარგი performance
- ✅ Auto-scaling
- ✅ Database hosting

**Deployment Steps:**

1. **შექმენით DigitalOcean account:**
   - გადადით: https://www.digitalocean.com
   - Sign up

2. **შექმენით App:**
   - App Platform → Create App
   - აირჩიეთ GitHub repository
   - Root Directory: `backend`

3. **Configure:**
   - Build Command: `npm install && npm run build`
   - Run Command: `npm run start:prod`
   - Environment Variables: დაამატეთ ყველა

4. **Deploy:**
   - DigitalOcean გააკეთებს deployment-ს
   - მიიღებთ URL-ს: `https://your-app.ondigitalocean.app`

**ფასი:** $5/თვე (Basic plan)

---

### 4. Fly.io

**პლიუსები:**
- ✅ უფასო tier
- ✅ Global edge network
- ✅ ძალიან სწრაფი
- ✅ Docker support

**Deployment Steps:**

1. **Install Fly CLI:**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Create fly.toml:**
   ```bash
   cd backend
   fly launch
   ```

4. **Configure fly.toml:**
   ```toml
   app = "your-app-name"
   primary_region = "iad"

   [build]
     builder = "paketobuildpacks/builder:base"

   [http_service]
     internal_port = 3005
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
     processes = ["app"]

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 256
   ```

5. **Set Secrets:**
   ```bash
   fly secrets set JWT_SECRET=your-secret
   fly secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   # ... და ა.შ.
   ```

6. **Deploy:**
   ```bash
   fly deploy
   ```

**ფასი:** უფასო tier: 3 shared-cpu-1x VMs, შემდეგ pay-as-you-go

---

### 5. Heroku

**პლიუსები:**
- ✅ ცნობილი პლატფორმა
- ✅ Add-ons ecosystem
- ⚠️ უფასო tier გაუქმდა (2022)

**Deployment Steps:**

1. **Install Heroku CLI:**
   ```bash
   # Windows
   # Download from: https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login:**
   ```bash
   heroku login
   ```

3. **Create App:**
   ```bash
   cd backend
   heroku create your-app-name
   ```

4. **Set Environment Variables:**
   ```bash
   heroku config:set JWT_SECRET=your-secret
   heroku config:set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   # ... და ა.შ.
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

**ფასი:** $7/თვე (Eco Dyno)

---

## 🔧 Production Environment Variables

დარწმუნდით რომ production-ში გაქვთ ეს environment variables:

```env
# Application
NODE_ENV=production
PORT=3005
FRONTEND_URL=https://your-frontend-domain.com
ADMIN_URL=https://your-admin-domain.com

# Authentication
JWT_SECRET=your-very-strong-secret-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Payment Gateways
TBC_PAY_MERCHANT_ID=your-merchant-id
TBC_PAY_SECRET_KEY=your-secret-key
LIBERTY_PAY_MERCHANT_ID=your-merchant-id
LIBERTY_PAY_SECRET_KEY=your-secret-key
BOG_PAY_MERCHANT_ID=your-merchant-id
BOG_PAY_SECRET_KEY=your-secret-key

# Business
DEFAULT_COMMISSION_PERCENTAGE=10
```

## 🔒 Security Checklist

Production deployment-ის წინ:

- [ ] `JWT_SECRET` შეცვლილია (არ გამოიყენოთ default)
- [ ] `NODE_ENV=production` დაყენებულია
- [ ] CORS კონფიგურირებულია მხოლოდ production domains-ისთვის
- [ ] Firebase credentials სწორად არის დაყენებული
- [ ] Swagger docs დაფარულია production-ში (optional)
- [ ] Error messages არ გამოაჩენს sensitive ინფორმაციას
- [ ] HTTPS enabled-ია
- [ ] Rate limiting დაყენებულია (recommended)

## 📝 Post-Deployment

1. **Test API:**
   ```bash
   curl https://your-api-domain.com/api
   ```

2. **Check Swagger Docs:**
   ```
   https://your-api-domain.com/api/docs
   ```

3. **Update Frontend:**
   - განაახლეთ `API_BASE_URL` frontend-ში
   - განაახლეთ `app.json` ან environment variables

4. **Monitor:**
   - შეამოწმეთ logs პლატფორმაზე
   - დაყენეთ monitoring (Sentry, LogRocket, etc.)

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"
- **Check:** Firebase credentials სწორად არის დაყენებული
- **Check:** Firestore API enabled-ია

### Issue: "JWT_SECRET is not properly configured"
- **Fix:** დაამატეთ `JWT_SECRET` environment variable-ში

### Issue: "CORS error"
- **Fix:** განაახლეთ `FRONTEND_URL` და `ADMIN_URL` environment variables-ში

### Issue: "Port already in use"
- **Fix:** გამოიყენეთ `PORT` environment variable ან platform-ის default port

## 💡 რეკომენდაცია

**დამწყებთათვის:** Railway ან Render (ყველაზე მარტივი)
**Production-ისთვის:** DigitalOcean App Platform ან Railway (საიმედოობა)

## 📚 დამატებითი რესურსები

- [NestJS Deployment](https://docs.nestjs.com/recipes/deployment)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform)

