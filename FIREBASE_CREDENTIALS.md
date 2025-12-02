# Firebase Credentials Setup

## Option 1: Service Account JSON (Recommended)

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the entire JSON content and paste it into `.env` as `FIREBASE_SERVICE_ACCOUNT`:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}
```

**Important**: The JSON must be on a single line. If you have multiline JSON, you need to:
- Remove all line breaks
- Escape quotes if needed
- Or use a JSON minifier

## Option 2: Individual Credentials

If you prefer to use individual environment variables:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

**Important for FIREBASE_PRIVATE_KEY**:
- Keep the quotes around the value
- The `\n` characters are literal - they will be converted to actual newlines
- The private key should start with `-----BEGIN PRIVATE KEY-----` or `-----BEGIN RSA PRIVATE KEY-----`

## Troubleshooting

### Error: "Failed to parse private key: Invalid PEM formatted message"

This usually means:
1. The private key format is incorrect
2. The `\n` characters weren't properly escaped
3. The private key was corrupted during copy/paste

**Solution**:
- Make sure the private key includes the BEGIN and END markers
- If using individual credentials, ensure the key is wrapped in quotes
- Try copying the key again from Firebase Console

### Error: "FIREBASE_SERVICE_ACCOUNT is missing required fields"

This means the JSON is incomplete or malformed.

**Solution**:
- Make sure you copied the entire JSON from Firebase Console
- Verify the JSON is valid (use a JSON validator)
- Ensure it's on a single line in the .env file

## Quick Test

After setting up credentials, restart your NestJS server. If Firebase initializes successfully, you should see no errors related to Firebase credentials.

