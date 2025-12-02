# Seed Test Users

ეს script შექმნის სატესტო იუზერებს Firestore-ში სხვადასხვა როლებით.

## გამოყენება

```bash
cd backend
npm run seed:users
```

## შექმნილი იუზერები

### Buyers (2 იუზერი)
- **buyer1@test.com** / +995555111111
  - Password: `password123`
  - Name: John Buyer

- **buyer2@test.com** / +995555222222
  - Password: `password123`
  - Name: Jane Smith

### Sellers (2 იუზერი)
- **seller1@test.com** / +995555333333
  - Password: `password123`
  - Name: Alice Seller

- **seller2@test.com** / +995555444444
  - Password: `password123`
  - Name: Bob Craftsman

### Admin (1 იუზერი)
- **admin@test.com** / +995555000000
  - Password: `admin123`
  - Name: Admin User

### Moderator (1 იუზერი)
- **moderator@test.com** / +995555999999
  - Password: `mod123`
  - Name: Moderator User

## მახასიათებლები

- ყველა იუზერი არის verified (email და phone)
- ყველა იუზერი არის active
- Passwords დაჰაშებულია bcrypt-ით
- თუ იუზერი უკვე არსებობს, script გამოტოვებს მას

## შენიშვნა

ეს script შეამოწმებს თუ იუზერი უკვე არსებობს email ან phone-ით და არ შექმნის duplicate-ს.

