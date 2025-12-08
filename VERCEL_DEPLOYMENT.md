# Vercel Deployment Guide

## ⚠️ პრობლემა: 500 Internal Server Error

თუ ყველა request-ზე 500 error ბრუნდება, ეს შეიძლება იყოს:
1. Firebase initialization error
2. Missing environment variables
3. CORS issues
4. Error handling not showing details

## ✅ გადაწყვეტა:

### Step 1: Vercel Configuration

1. **vercel.json** უკვე შექმნილია
2. **api/index.ts** - Vercel serverless function handler

### Step 2: Environment Variables

Vercel Dashboard → Settings → Environment Variables → დაამატეთ:

```env
NODE_ENV=production
PORT=3005
JWT_SECRET=your-secret-key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_PROJECT_ID=handmade-backend-1debc
FIREBASE_STORAGE_BUCKET=handmade-backend-1debc.firebasestorage.app
FRONTEND_URL=https://your-frontend.vercel.app
ADMIN_URL=https://your-admin.vercel.app
```

### Step 3: Build Settings

Vercel Dashboard → Settings → Build & Development Settings:

- **Build Command:** `cd backend && npm install && npm run build`
- **Output Directory:** `backend/dist`
- **Install Command:** `cd backend && npm install`

### Step 4: Check Logs

Vercel Dashboard → Deployments → Click on latest deployment → Functions → View Logs

აქ ნახავთ დეტალურ error messages-ს.

## 🔍 Debugging:

### 1. Check Vercel Logs

```bash
# Install Vercel CLI
npm i -g vercel

# View logs
vercel logs
```

### 2. Test Locally

```bash
cd backend
npm run build
vercel dev
```

### 3. Check Environment Variables

Vercel Dashboard → Settings → Environment Variables

დარწმუნდით რომ:
- ✅ `JWT_SECRET` დაყენებულია
- ✅ `FIREBASE_SERVICE_ACCOUNT` სწორად არის დაყენებული (მთელი JSON ერთ ხაზზე)
- ✅ `FIREBASE_PROJECT_ID` დაყენებულია

## 🐛 Common Issues:

### Issue: "Internal server error" on all requests

**გადაწყვეტა:**
1. შეამოწმეთ Vercel logs
2. შეამოწმეთ environment variables
3. შეამოწმეთ Firebase initialization

### Issue: CORS errors

**გადაწყვეტა:**
1. დაამატეთ `FRONTEND_URL` environment variable-ში
2. ან დროებით allow all origins (development-ისთვის)

### Issue: Firebase initialization fails

**გადაწყვეტა:**
1. შეამოწმეთ `FIREBASE_SERVICE_ACCOUNT` - უნდა იყოს მთელი JSON ერთ ხაზზე
2. შეამოწმეთ `private_key` field - უნდა იყოს სრული key (1600+ chars), არა `private_key_id`

## ✅ Success Checklist:

- [ ] `vercel.json` არსებობს
- [ ] `api/index.ts` არსებობს
- [ ] Environment variables დაყენებულია
- [ ] Build successful
- [ ] Logs-ში არ არის errors
- [ ] `/api` endpoint მუშაობს
- [ ] `/api/health` endpoint მუშაობს

---

**🎯 როცა ყველაფერი დაყენდება, API იმუშავებს Vercel-ზე!**

