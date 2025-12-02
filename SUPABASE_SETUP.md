# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Create a new project
4. Wait for the project to be provisioned (takes ~2 minutes)

## 2. Get Database Connection String

1. Go to **Project Settings** → **Database**
2. Find **Connection string** section
3. Select **URI** tab
4. Copy the connection string
5. It should look like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

**Important:** Replace `[YOUR-PASSWORD]` with your actual database password (shown when you create the project).

## 3. Get Supabase API Keys

1. Go to **Project Settings** → **API**
2. Copy the following:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` (for client-side)
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (for server-side, keep secret!)

## 4. Create Storage Bucket

1. Go to **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `handmade-marketplace`
4. Make it **Public** (if you want public access to uploaded files)
5. Click **Create bucket**

## 5. Configure Environment Variables

Create `backend/.env` file:

```env
# Supabase Database
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Supabase API
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Supabase Storage
SUPABASE_STORAGE_BUCKET=handmade-marketplace

# Storage Type (use 'supabase' for Supabase Storage)
STORAGE_TYPE=supabase

# Other configurations...
PORT=3005
JWT_SECRET=your-secret-key
# ... etc
```

## 6. Install Dependencies

```bash
cd backend
npm install
```

The `@supabase/supabase-js` package is already included in `package.json`.

## 7. Run the Application

```bash
npm run start:dev
```

The application will:
- Connect to Supabase database
- Automatically create tables (in development mode)
- Use Supabase Storage for file uploads

## 8. Verify Connection

1. Check console logs - should show "Application is running on: http://localhost:3005"
2. Visit http://localhost:3005/api/docs for Swagger documentation
3. Try uploading a file through the API

## Database Tables

The application will automatically create these tables on first run:
- `users`
- `seller_profiles`
- `products`
- `product_images`
- `product_variants`
- `categories`
- `orders`
- `order_items`
- `reviews`
- `wishlist`
- `notifications`
- `chat_messages`
- `banners`

## Storage Structure

Files uploaded to Supabase Storage will be organized as:
```
handmade-marketplace/
├── uploads/
│   ├── products/
│   ├── avatars/
│   └── banners/
```

## Security Notes

- **Never commit** `.env` file to version control
- **Keep `SUPABASE_SERVICE_ROLE_KEY` secret** - it has admin access
- Use **Row Level Security (RLS)** in Supabase for additional security
- Enable **SSL** connections (already configured in the code)

## Troubleshooting

### Connection Issues
- Verify your connection string is correct
- Check that your IP is allowed in Supabase dashboard (Settings → Database → Connection pooling)
- Ensure SSL is enabled (already configured)

### Storage Issues
- Verify bucket name matches `SUPABASE_STORAGE_BUCKET`
- Check bucket is set to Public if you need public URLs
- Verify `SUPABASE_SERVICE_ROLE_KEY` has storage permissions

### Migration Issues
- In development, `synchronize: true` will auto-create tables
- For production, use migrations: `npm run migration:generate` and `npm run migration:run`

## Next Steps

1. Set up Row Level Security policies in Supabase dashboard
2. Configure backup strategy in Supabase
3. Set up monitoring and alerts
4. Configure custom domain (optional)
