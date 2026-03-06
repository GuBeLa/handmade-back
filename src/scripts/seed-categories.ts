/**
 * Seed script: Replace all product categories with the standard list (EN + KA).
 * Run: npx ts-node src/scripts/seed-categories.ts
 * Note: Only updates the categories collection. Existing products keep their categoryId;
 * you may need to reassign products to new categories if you had different category names.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Minimalist Unsplash images per category (icon 400x400, image 800x600)
const CATEGORIES = [
  { nameEn: 'Accessories', name: 'აქსესუარები', imageId: '1523275335684-37898b6baf30' },
  { nameEn: 'Art & Collectibles', name: 'ხელოვნება და კოლექციური ნივთები', imageId: '1561214115-f2f134cc4912' },
  { nameEn: 'Baby', name: 'ბავშვის პროდუქცია', imageId: '1587654780291-39c9404d746b' },
  { nameEn: 'Bags & Purses', name: 'ჩანთები და საფულეები', imageId: '1584917865442-de89df76afd3' },
  { nameEn: 'Bath & Beauty', name: 'სილამაზე და მოვლა', imageId: '1596462509314-39f2b6e7c1e0' },
  { nameEn: 'Books, Movies & Music', name: 'წიგნები, ფილმები და მუსიკა', imageId: '1512820790803-83ca734da794' },
  { nameEn: 'Clothing', name: 'ტანსაცმელი', imageId: '1558171813-4c088753af8f' },
  { nameEn: 'Craft Supplies & Tools', name: 'ხელსაქმის მასალები', imageId: '1504917595217-d4dc5ebe6122' },
  { nameEn: 'Electronics & Accessories', name: 'ელექტრონიკა და აქსესუარები', imageId: '1527864550417-7fd91fc51a46' },
  { nameEn: 'Gifts', name: 'საჩუქრები', imageId: '1513885535751-8b9238bd345a' },
  { nameEn: 'Home & Living', name: 'სახლი და ინტერიერი', imageId: '1484101403633-562f891dc89a' },
  { nameEn: 'Jewelry', name: 'სამკაულები', imageId: '1515562141207-7a88fb7ce338' },
  { nameEn: 'Paper & Party Supplies', name: 'საკანცელარიო და წვეულება', imageId: '1544716278-ca5e3f4abd8c' },
  { nameEn: 'Pet Supplies', name: 'ცხოველების აქსესუარები', imageId: '1548199973-03cce0bbc87b' },
  { nameEn: 'Shoes', name: 'ფეხსაცმელი', imageId: '1542291026-7eec264c27ff' },
  { nameEn: 'Toys & Games', name: 'სათამაშოები და თამაშები', imageId: '1558618666-fcd25c85cd64' },
  { nameEn: 'Weddings', name: 'საქორწილო', imageId: '1519741497674-611481863552' },
];

function getCategoryImageUrls(imageId: string) {
  const base = `https://images.unsplash.com/photo-${imageId}`;
  return {
    icon: `${base}?w=400&h=400&fit=crop`,
    image: `${base}?w=800&h=600&fit=crop`,
  };
}

function initializeFirebase(): Firestore {
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
  }

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

async function seedCategories() {
  const db = initializeFirebase();
  const now = Timestamp.now();

  console.log('📁 Seeding categories (replace existing)...\n');

  const existing = await db.collection('categories').get();
  for (const doc of existing.docs) {
    await doc.ref.delete();
  }
  console.log(`🗑️  Deleted ${existing.size} existing categories.\n`);

  let created = 0;
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const slug = cat.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { icon, image } = getCategoryImageUrls(cat.imageId);
    try {
      const ref = db.collection('categories').doc();
      await ref.set({
        name: cat.name,
        nameEn: cat.nameEn,
        slug,
        description: cat.name,
        descriptionEn: cat.nameEn,
        parentId: null,
        image,
        icon,
        sortOrder: i,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`✅ ${cat.nameEn} — ${cat.name}`);
      created++;
    } catch (error: any) {
      console.error(`❌ ${cat.nameEn}:`, error.message);
    }
  }

  console.log(`\n✅ Done. Created ${created} categories.`);
}

seedCategories().catch((err) => {
  console.error(err);
  process.exit(1);
});
