# Environment Variables Setup

## Quick Start

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. **IMPORTANT**: Update the following required variables in `.env`:

   - `JWT_SECRET` - Generate a secure random string (at least 32 characters)
     ```bash
     # Generate a secure JWT secret (Linux/Mac)
     openssl rand -base64 32
     
     # Or use Node.js
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

   - `FIREBASE_PROJECT_ID` - Your Firebase project ID
   - `FIREBASE_SERVICE_ACCOUNT` - Your Firebase service account JSON (or use individual credentials)
   - `FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket name

## Required Variables

### Minimum Required for Development:
- `JWT_SECRET` - Must be changed from placeholder value
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON

### Optional (for full functionality):
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - For SMS verification
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - For Google OAuth
- Payment gateway credentials - For payment processing
- SMTP credentials - For email sending

## Security Notes

- **NEVER commit `.env` file to version control**
- Use strong, random values for `JWT_SECRET` in production
- Keep Firebase service account credentials secure
- Rotate secrets regularly in production

