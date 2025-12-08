# JWT_SECRET-ის განახლება

## ✅ რა გაკეთდა:

1. გენერირებულია ძლიერი JWT_SECRET (128 სიმბოლო)
2. განახლებულია `backend/env` ფაილი
3. შექმნილია `generate-jwt-secret.js` script

## 🔧 როგორ შევქმნათ `.env` ფაილი:

NestJS კითხულობს `.env` ფაილს (არა `env`). შექმენით `.env` ფაილი:

### Windows (PowerShell):
```powershell
cd backend
Copy-Item env .env
```

### Windows (CMD):
```cmd
cd backend
copy env .env
```

### Mac/Linux:
```bash
cd backend
cp env .env
```

## 🔑 JWT_SECRET:

ახალი JWT_SECRET (გენერირებული):
```
12080f221149790dbadc478e4be7836bd8b09da6d2d17c687d896758a19a905d96de419913d9770ba2504a5e09f115a4295b5a6b1f0f41018d17e28e6e1ce96b
```

ეს secret უკვე დამატებულია `env` ფაილში. როცა შექმნით `.env` ფაილს, ის ავტომატურად იქნება იქ.

## 🔄 ახალი JWT_SECRET-ის გენერაცია:

თუ გსურთ ახალი secret-ის გენერაცია:

```bash
cd backend
node generate-jwt-secret.js
```

ან:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## ⚠️ მნიშვნელოვანი:

- `.env` ფაილი **არ უნდა** იყოს Git-ში (უკვე დამატებულია `.gitignore`-ში)
- JWT_SECRET **არ უნდა** გაზიარებული იყოს
- Production-ში გამოიყენეთ სხვა, ძლიერი secret

## ✅ შემოწმება:

როცა შექმნით `.env` ფაილს, გაუშვით backend:

```bash
cd backend
npm run start:dev
```

თუ შეცდომა აღარ გამოჩნდება, ყველაფერი კარგადაა! 🎉

