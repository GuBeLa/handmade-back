# Firebase Service Account Environment Variable Setup

## ⚠️ პრობლემა:

Deployment-ისას გამოდის შეცდომა:
```
Error: Failed to parse private key: Error: Invalid PEM formatted message.
```

ეს ხდება როცა `FIREBASE_SERVICE_ACCOUNT` environment variable-ში private key არასწორად არის ფორმატირებული.

## ✅ გადაწყვეტა:

### Step 1: Firebase Service Account JSON-ის მიღება

1. გადადით: https://console.firebase.google.com
2. აირჩიეთ თქვენი project
3. Settings (⚙️) → Project Settings → Service Accounts
4. Click **"Generate New Private Key"**
5. Download JSON ფაილი

### Step 2: JSON-ის გადაქცევა Single Line-ად

Firebase Service Account JSON უნდა იყოს **მთელი ერთ ხაზზე** environment variable-ში.

**მაგალითი JSON:**
```json
{
  "type": "service_account",
  "project_id": "handmade-backend-1debc",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCT26OEjc6+AM0V\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@handmade-backend-1debc.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### Step 3: Railway/Vercel-ზე დაყენება

#### Railway:

1. Railway Dashboard → Your Service → Variables
2. Click **"+ New Variable"**
3. **Name:** `FIREBASE_SERVICE_ACCOUNT`
4. **Value:** მთელი JSON ერთ ხაზზე (no line breaks):
   ```json
   {"type":"service_account","project_id":"handmade-backend-1debc","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCT26OEjc6+AM0V\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@handmade-backend-1debc.iam.gserviceaccount.com",...}
   ```

#### Vercel:

1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Click **"Add New"**
3. **Key:** `FIREBASE_SERVICE_ACCOUNT`
4. **Value:** მთელი JSON ერთ ხაზზე

### Step 4: JSON-ის Minify (ერთ ხაზზე გადაქცევა)

**Option 1: Online Tool**
- გადადით: https://www.jsonformatter.org/json-minify
- Paste JSON
- Click "Minify"
- Copy result

**Option 2: Node.js Script**
```javascript
const fs = require('fs');
const json = JSON.parse(fs.readFileSync('service-account.json', 'utf8'));
console.log(JSON.stringify(json));
```

**Option 3: VS Code**
1. Open JSON file
2. Format Document (Shift+Alt+F)
3. Remove all line breaks manually
4. ან გამოიყენეთ extension: "JSON Minify"

### Step 5: Private Key Formatting

**მნიშვნელოვანი:** Private key-ში `\n` characters უნდა იყოს **escaped** JSON string-ში:

```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCT26OEjc6+AM0V\n1JWvLFZIYAe9ikjP5BxY7SVHoM1cWgfZQXHpQesNOaocId8UTq52zsY6bw8DHcrf\n...\n-----END PRIVATE KEY-----\n"
```

**არა:**
```json
"private_key": "-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCT26OEjc6+AM0V
1JWvLFZIYAe9ikjP5BxY7SVHoM1cWgfZQXHpQesNOaocId8UTq52zsY6bw8DHcrf
...
-----END PRIVATE KEY-----"
```

## 🔍 Validation

კოდი ავტომატურად ასწორებს:
- `\\n` → `\n` (escaped newlines)
- Missing `BEGIN PRIVATE KEY` markers
- Missing `END PRIVATE KEY` markers

## ✅ Checklist

- [ ] Firebase Service Account JSON downloaded
- [ ] JSON minified (ერთ ხაზზე)
- [ ] Private key-ში `\n` characters escaped-ია
- [ ] Environment variable დაყენებულია Railway/Vercel-ზე
- [ ] Application restarted/redeployed
- [ ] No Firebase initialization errors

## 🐛 Troubleshooting

### Issue: "Invalid PEM formatted message"

**გადაწყვეტა:**
1. შეამოწმეთ რომ private key-ში არის `\n` characters (არა actual newlines)
2. შეამოწმეთ რომ JSON არის valid (use JSON validator)
3. შეამოწმეთ რომ `BEGIN PRIVATE KEY` და `END PRIVATE KEY` markers არის

### Issue: "Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON"

**გადაწყვეტა:**
1. შეამოწმეთ JSON syntax (use JSON validator)
2. დარწმუნდით რომ არ არის extra quotes ან escaping issues
3. გამოიყენეთ JSON minifier tool

### Issue: "Missing required fields"

**გადაწყვეტა:**
1. შეამოწმეთ რომ JSON-ში არის:
   - `project_id`
   - `private_key`
   - `client_email`
2. შეამოწმეთ field names (არ უნდა იყოს typos)

## 📝 Example (Correct Format)

```json
{"type":"service_account","project_id":"handmade-backend-1debc","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCT26OEjc6+AM0V\n1JWvLFZIYAe9ikjP5BxY7SVHoM1cWgfZQXHpQesNOaocId8UTq52zsY6bw8DHcrf\nsGETonIlSk0/0/W59oKWBAqibBBIv1DYLWjOI3yMNB1n0TEjAjkrSd+vsfRhJHpS\nOp8M5uXgsbdNjQfQbq6CZrd4h4ygZe+F3McAxJ8sXS0dHQucfXf0rY9nzrjYvm6d\nIMefKi/bTCV07Z4aokvR7cagUqlymc7cNg5jdLN7vkPkdZnNXJ0Po+AHwOAeozcS\nZv7vRvO2nV+//J9wvfxKgIQWGKPkTZi4USyA8O7DANG4lyZlCrNmAUiAByIvgfmk\nN44Agw7fAgMBAAECggEABGsYnjcFA1u1+GQ7e0CX7RG+XKuezjEpQUvU3iiv+lKD\nNlRkuW1LpaZTe9CHTTpzFcz+bECYi9jk3X2ONeGYB57XMB3lYE+j5CSHkzlaqZ6n\ni841+fL77DSieR4gzPfQ1yC3m0h2Edd4aeMJxBjvEm49GNQq2s+nGotECeLP3cfv\nMrp7Dlcc1AQOENeBnahXcHnxu+tunlzBmfIZrVFqNDzrMq3F9nqLLh8UPexWDQiP\nKOyc9jlA/0VEvJqAgEVMIEr3+xaIWNB9BAe3cAh/4dk7EVrbzcweGCA/oCQi0N7r\nYGfSdFA6QdMbwtPg4Q+xgEVSSL+z9ISUZQkKLgc0AQKBgQDEzUaVxI2ICI5mMboU\n9mPddyKBD5KnzDuuFTLenB85P8OQaWTpCPgU7qZFFERzIjlZwWkxZxlQvZ0AKXOz\nRECwVuYo1XxwTvv+hni3pnjZHDzA2r6Mn+hf7U4hb3wdx0ck/xeMOujyLfdI8cOk\nHDyJWCtIu8TSkx7eWuvwzHTg9wKBgQDAVXBqpOzYnP/dSTGzdskKsnyLfJQ0lDn4\n9kuN5fwtFZU0eF/W0FgCuPHdIOUeFSjnG1pQ5ww4N3Rmn3/E6xHwLIUABopDI2nO\nIDoqPsYq0agiiAX5bD5OAWMmXVXc4jx8LYNKm9m9/LOuEOmc1AZMxxaAb+u8PFE1\noyWmvKivWQKBgEZ7/rvFGauO5PFU/gBj/oBjGsh+e1f9naJLlVyFLemjHLesB6gu\nvitBDevPxnQ13bR3wOUgt8BjKMfWEMozt7dwaB5X16mhoD8YikO8K6wWoOuxbG2R\nF/jDVShEdX90z9ZARn7C2otiSx6k+BzewA+wtE/ocCW662NXzQkBMRshAoGAK2we\nsTUC8/SeH4uC2Q2cXfnl/Gfn3ecJH5gbfrHJuTQCN5JlsM3g0NyIXnAqyhvk3Chk\nv5cqPxbmBLVF12Nq7VpfvJ29YWMBZDQKbbc2bjxfRUyIbMNvXZUamXLBC9lX5oEv\n/wwooKgIuOfAllOYCIV6Iw0hn6HOg9mNipNVUiECgYEAq+LAmN0C72tzBrPJlbLY\nsRNDz95D1jbsp9uh8/5/coN/SIweYhiU3EGLhKqT6iuS6mdEtGl5TpvCdTVIEL/8\nEU+lVzbB+SFRmBXcp97mKWmpPOga5aCatWEbBJR2r9wM+MfC2sQ8Ag+k4PbNelsQ\nrZqm4XahBOqJqIunyzinDi8=\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-fbsvc@handmade-backend-1debc.iam.gserviceaccount.com"}
```

---

**🎯 როცა ყველაფერი სწორად დაყენდება, Firebase initialization წარმატებით გაიარებს!**

