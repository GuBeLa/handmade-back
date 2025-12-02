import * as bcrypt from 'bcrypt';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Try alternative path
  dotenv.config();
}

// User roles
enum UserRole {
  GUEST = 'guest',
  BUYER = 'buyer',
  SELLER = 'seller',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

// Test users data
const testUsers = [
  // Buyers
  {
    email: 'buyer1@test.com',
    phone: '+995555111111',
    password: 'password123',
    firstName: 'John',
    lastName: 'Buyer',
    role: UserRole.BUYER,
  },
  {
    email: 'buyer2@test.com',
    phone: '+995555222222',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith',
    role: UserRole.BUYER,
  },
  // Sellers
  {
    email: 'seller1@test.com',
    phone: '+995555333333',
    password: 'password123',
    firstName: 'Alice',
    lastName: 'Seller',
    role: UserRole.SELLER,
  },
  {
    email: 'seller2@test.com',
    phone: '+995555444444',
    password: 'password123',
    firstName: 'Bob',
    lastName: 'Craftsman',
    role: UserRole.SELLER,
  },
  // Admin
  {
    email: 'admin@test.com',
    phone: '+995555000000',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
  },
  // Moderator
  {
    email: 'moderator@test.com',
    phone: '+995555999999',
    password: 'mod123',
    firstName: 'Moderator',
    lastName: 'User',
    role: UserRole.MODERATOR,
  },
];

function initializeFirebase(): Firestore {
  // Check if Firebase is already initialized
  if (getApps().length > 0) {
    return getFirestore(getApps()[0]);
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccount && serviceAccount !== '{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}') {
    try {
      const serviceAccountJson = JSON.parse(serviceAccount);
      
      if (!serviceAccountJson.project_id || !serviceAccountJson.private_key || !serviceAccountJson.client_email) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT is missing required fields');
      }
      
      // Fix private key formatting
      if (serviceAccountJson.private_key) {
        serviceAccountJson.private_key = serviceAccountJson.private_key.replace(/\\n/g, '\n');
      }
      
      const app = initializeApp({
        credential: cert(serviceAccountJson),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccountJson.project_id}.appspot.com`,
        projectId: serviceAccountJson.project_id,
      });
      
      return getFirestore(app);
    } catch (error: any) {
      throw new Error(`Failed to initialize Firebase: ${error.message}`);
    }
  } else {
    // Use individual credentials
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    
    if (!projectId || !privateKey || !clientEmail) {
      throw new Error('Firebase credentials are not properly configured in .env file');
    }
    
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    
    const app = initializeApp({
      credential: cert({
        projectId,
        privateKey: formattedPrivateKey,
        clientEmail,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });
    
    return getFirestore(app);
  }
}

async function seedUsers() {
  try {
    console.log('🌱 Starting user seeding...\n');

    // Initialize Firebase
    const db = initializeFirebase();

    let created = 0;
    let skipped = 0;

    for (const userData of testUsers) {
      try {
        // Check if user already exists
        let existingUser = null;
        
        if (userData.email) {
          const emailSnapshot = await db.collection('users')
            .where('email', '==', userData.email)
            .limit(1)
            .get();
          if (!emailSnapshot.empty) {
            existingUser = { id: emailSnapshot.docs[0].id, ...emailSnapshot.docs[0].data() };
          }
        }
        
        if (!existingUser && userData.phone) {
          const phoneSnapshot = await db.collection('users')
            .where('phone', '==', userData.phone)
            .limit(1)
            .get();
          if (!phoneSnapshot.empty) {
            existingUser = { id: phoneSnapshot.docs[0].id, ...phoneSnapshot.docs[0].data() };
          }
        }

        if (existingUser) {
          console.log(`⏭️  User ${userData.email || userData.phone} already exists, skipping...`);
          skipped++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Create user document
        const now = Timestamp.now();
        const userRef = db.collection('users').doc();
        await userRef.set({
          email: userData.email,
          phone: userData.phone,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        console.log(`✅ Created user: ${userData.email || userData.phone} (${userData.role})`);
        created++;
      } catch (error: any) {
        console.error(`❌ Error creating user ${userData.email || userData.phone}:`, error.message);
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Created: ${created} users`);
    console.log(`⏭️  Skipped: ${skipped} users (already exist)`);
    console.log('✨ Seeding completed!\n');

    // Print test credentials
    console.log('📝 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsers.forEach((user) => {
      console.log(`${user.role.toUpperCase()}:`);
      if (user.email) console.log(`  Email: ${user.email}`);
      if (user.phone) console.log(`  Phone: ${user.phone}`);
      console.log(`  Password: ${user.password}`);
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedUsers();
}

export { seedUsers };

