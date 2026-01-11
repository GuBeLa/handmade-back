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
  dotenv.config();
}

function initializeFirebase(): Firestore {
  if (getApps().length === 0) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not found or invalid');
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  
  return getFirestore();
}

// FAQ Categories data - 6 predefined categories
const faqCategories = [
  {
    id: 'orders',
    title: 'შეკვეთები',
    titleEn: 'Orders',
    description: 'შეკვეთების შესახებ ხშირად დასმული კითხვები',
    descriptionEn: 'Frequently asked questions about orders',
    icon: 'receipt-outline',
    order: 1,
    isActive: true,
  },
  {
    id: 'payments',
    title: 'გადახდები',
    titleEn: 'Payments',
    description: 'გადახდის მეთოდებისა და პროცესების შესახებ',
    descriptionEn: 'About payment methods and processes',
    icon: 'card-outline',
    order: 2,
    isActive: true,
  },
  {
    id: 'delivery',
    title: 'მიტანა',
    titleEn: 'Delivery',
    description: 'მიტანის მეთოდები, ხარჯები და დრო',
    descriptionEn: 'Delivery methods, costs and timing',
    icon: 'car-outline',
    order: 3,
    isActive: true,
  },
  {
    id: 'returns',
    title: 'დაბრუნება/გაცვლა',
    titleEn: 'Returns/Exchanges',
    description: 'დაბრუნებისა და გაცვლის პოლიტიკა',
    descriptionEn: 'Return and exchange policy',
    icon: 'swap-horizontal-outline',
    order: 4,
    isActive: true,
  },
  {
    id: 'sellers',
    title: 'მაღაზიებისთვის',
    titleEn: 'For Sellers',
    description: 'ინფორმაცია მაღაზიებისთვის',
    descriptionEn: 'Information for sellers',
    icon: 'storefront-outline',
    order: 5,
    isActive: true,
  },
  {
    id: 'account',
    title: 'ანგარიშის მართვა',
    titleEn: 'Account Management',
    description: 'ანგარიშის პარამეტრები და მართვა',
    descriptionEn: 'Account settings and management',
    icon: 'person-outline',
    order: 6,
    isActive: true,
  },
];

async function seedFAQCategories() {
  try {
    console.log('📚 Seeding FAQ Categories...\n');
    
    const db = initializeFirebase();
    let created = 0;
    let skipped = 0;
    
    for (const categoryData of faqCategories) {
      try {
        // Check if category already exists by id
        const existingRef = db.collection('faq_categories').doc(categoryData.id);
        const existingDoc = await existingRef.get();
        
        const now = Timestamp.now();
        
        if (existingDoc.exists) {
          // Update existing category
          await existingRef.update({
            title: categoryData.title,
            titleEn: categoryData.titleEn,
            description: categoryData.description,
            descriptionEn: categoryData.descriptionEn,
            icon: categoryData.icon,
            order: categoryData.order,
            isActive: categoryData.isActive,
            updatedAt: now,
          });
          console.log(`🔄 Updated FAQ category: ${categoryData.title} (${categoryData.titleEn})`);
          created++;
        } else {
          // Create new category
          await existingRef.set({
            title: categoryData.title,
            titleEn: categoryData.titleEn,
            description: categoryData.description,
            descriptionEn: categoryData.descriptionEn,
            icon: categoryData.icon,
            order: categoryData.order,
            isActive: categoryData.isActive,
            createdAt: now,
            updatedAt: now,
          });
          console.log(`✅ Created FAQ category: ${categoryData.title} (${categoryData.titleEn})`);
          created++;
        }
      } catch (error: any) {
        console.error(`❌ Error creating FAQ category ${categoryData.id}:`, error.message);
      }
    }
    
    console.log(`\n📊 FAQ Categories: Created/Updated ${created}, Skipped ${skipped}\n`);
    return { created, skipped };
  } catch (error: any) {
    console.error('\n❌ FAQ Categories seeding failed:', error.message);
    console.error(error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedFAQCategories()
    .then(() => {
      console.log('✨ FAQ Categories seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ FAQ Categories seeding failed:', error);
      process.exit(1);
    });
}

export { seedFAQCategories };
