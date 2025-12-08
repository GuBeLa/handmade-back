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

// Moderation status
enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// Placeholder images from Unsplash (free to use)
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=800&fit=crop',
];

// Test products data
const testProducts = [
  // Jewelry
  {
    title: 'Handmade Silver Necklace',
    titleEn: 'Handmade Silver Necklace',
    description: 'Beautiful handcrafted silver necklace with intricate details. Perfect for special occasions or everyday wear. Made with love and attention to detail.',
    descriptionEn: 'Beautiful handcrafted silver necklace with intricate details. Perfect for special occasions or everyday wear. Made with love and attention to detail.',
    price: 89.99,
    discountPrice: 69.99,
    stock: 15,
    material: 'Sterling Silver',
    weight: '25g',
    dimensions: '45cm length',
    careInstructions: 'Store in a dry place. Clean with soft cloth.',
    careInstructionsEn: 'Store in a dry place. Clean with soft cloth.',
    categoryName: 'Jewelry',
    variants: [
      { size: 'Small', price: 69.99, stock: 5 },
      { size: 'Medium', price: 79.99, stock: 7 },
      { size: 'Large', price: 89.99, stock: 3 },
    ],
  },
  {
    title: 'Handmade Gold Ring',
    titleEn: 'Handmade Gold Ring',
    description: 'Elegant gold ring with unique design. Handcrafted by skilled artisans. Available in multiple sizes.',
    descriptionEn: 'Elegant gold ring with unique design. Handcrafted by skilled artisans. Available in multiple sizes.',
    price: 149.99,
    stock: 10,
    material: '14K Gold',
    weight: '8g',
    dimensions: 'Ring size 6-9',
    careInstructions: 'Avoid contact with chemicals. Polish regularly.',
    careInstructionsEn: 'Avoid contact with chemicals. Polish regularly.',
    categoryName: 'Jewelry',
    variants: [
      { size: '6', price: 149.99, stock: 2 },
      { size: '7', price: 149.99, stock: 3 },
      { size: '8', price: 149.99, stock: 3 },
      { size: '9', price: 149.99, stock: 2 },
    ],
  },
  // Home Decor
  {
    title: 'Handwoven Wool Blanket',
    titleEn: 'Handwoven Wool Blanket',
    description: 'Cozy and warm handwoven wool blanket. Perfect for your living room or bedroom. Made from premium quality wool.',
    descriptionEn: 'Cozy and warm handwoven wool blanket. Perfect for your living room or bedroom. Made from premium quality wool.',
    price: 129.99,
    stock: 8,
    material: '100% Wool',
    weight: '1.2kg',
    dimensions: '150cm x 200cm',
    careInstructions: 'Dry clean only. Do not machine wash.',
    careInstructionsEn: 'Dry clean only. Do not machine wash.',
    categoryName: 'Home Decor',
  },
  {
    title: 'Ceramic Vase Set',
    titleEn: 'Ceramic Vase Set',
    description: 'Beautiful set of 3 ceramic vases in different sizes. Hand-painted with traditional patterns. Perfect for home decoration.',
    descriptionEn: 'Beautiful set of 3 ceramic vases in different sizes. Hand-painted with traditional patterns. Perfect for home decoration.',
    price: 79.99,
    stock: 12,
    material: 'Ceramic',
    weight: '2.5kg',
    dimensions: 'Small: 15cm, Medium: 25cm, Large: 35cm',
    careInstructions: 'Hand wash only. Handle with care.',
    careInstructionsEn: 'Hand wash only. Handle with care.',
    categoryName: 'Home Decor',
  },
  // Clothing
  {
    title: 'Handmade Cotton Scarf',
    titleEn: 'Handmade Cotton Scarf',
    description: 'Soft and comfortable cotton scarf. Handwoven with traditional techniques. Available in multiple colors.',
    descriptionEn: 'Soft and comfortable cotton scarf. Handwoven with traditional techniques. Available in multiple colors.',
    price: 39.99,
    stock: 20,
    material: '100% Cotton',
    weight: '150g',
    dimensions: '180cm x 60cm',
    careInstructions: 'Machine wash cold. Tumble dry low.',
    careInstructionsEn: 'Machine wash cold. Tumble dry low.',
    categoryName: 'Clothing',
    variants: [
      { color: 'Blue', price: 39.99, stock: 7 },
      { color: 'Red', price: 39.99, stock: 6 },
      { color: 'Green', price: 39.99, stock: 7 },
    ],
  },
  {
    title: 'Handknitted Wool Sweater',
    titleEn: 'Handknitted Wool Sweater',
    description: 'Warm and cozy handknitted wool sweater. Perfect for winter. Made with premium wool yarn.',
    descriptionEn: 'Warm and cozy handknitted wool sweater. Perfect for winter. Made with premium wool yarn.',
    price: 99.99,
    discountPrice: 79.99,
    stock: 6,
    material: '100% Wool',
    weight: '500g',
    dimensions: 'S, M, L, XL',
    careInstructions: 'Hand wash in cold water. Lay flat to dry.',
    careInstructionsEn: 'Hand wash in cold water. Lay flat to dry.',
    categoryName: 'Clothing',
    variants: [
      { size: 'S', price: 79.99, stock: 1 },
      { size: 'M', price: 79.99, stock: 2 },
      { size: 'L', price: 79.99, stock: 2 },
      { size: 'XL', price: 79.99, stock: 1 },
    ],
  },
  // Accessories
  {
    title: 'Leather Handbag',
    titleEn: 'Leather Handbag',
    description: 'Elegant leather handbag with hand-stitched details. Perfect for everyday use. Made from genuine leather.',
    descriptionEn: 'Elegant leather handbag with hand-stitched details. Perfect for everyday use. Made from genuine leather.',
    price: 159.99,
    stock: 5,
    material: 'Genuine Leather',
    weight: '800g',
    dimensions: '35cm x 28cm x 12cm',
    careInstructions: 'Clean with leather conditioner. Keep away from water.',
    careInstructionsEn: 'Clean with leather conditioner. Keep away from water.',
    categoryName: 'Accessories',
  },
  {
    title: 'Handmade Wooden Watch',
    titleEn: 'Handmade Wooden Watch',
    description: 'Unique wooden watch with natural wood grain. Eco-friendly and stylish. Perfect for nature lovers.',
    descriptionEn: 'Unique wooden watch with natural wood grain. Eco-friendly and stylish. Perfect for nature lovers.',
    price: 119.99,
    stock: 9,
    material: 'Bamboo Wood',
    weight: '50g',
    dimensions: 'Watch face: 42mm',
    careInstructions: 'Avoid water. Clean with dry cloth.',
    careInstructionsEn: 'Avoid water. Clean with dry cloth.',
    categoryName: 'Accessories',
  },
  // Art & Crafts
  {
    title: 'Hand-painted Canvas Art',
    titleEn: 'Hand-painted Canvas Art',
    description: 'Beautiful hand-painted canvas artwork. Original piece created by local artist. Perfect for home decoration.',
    descriptionEn: 'Beautiful hand-painted canvas artwork. Original piece created by local artist. Perfect for home decoration.',
    price: 199.99,
    stock: 3,
    material: 'Canvas, Acrylic Paint',
    weight: '1.5kg',
    dimensions: '50cm x 70cm',
    careInstructions: 'Keep away from direct sunlight. Dust with soft cloth.',
    careInstructionsEn: 'Keep away from direct sunlight. Dust with soft cloth.',
    categoryName: 'Art & Crafts',
  },
  {
    title: 'Handmade Pottery Bowl Set',
    titleEn: 'Handmade Pottery Bowl Set',
    description: 'Set of 4 handmade pottery bowls. Each piece is unique. Perfect for serving or decoration.',
    descriptionEn: 'Set of 4 handmade pottery bowls. Each piece is unique. Perfect for serving or decoration.',
    price: 69.99,
    stock: 7,
    material: 'Clay, Glazed',
    weight: '2kg',
    dimensions: 'Bowl diameter: 15cm each',
    careInstructions: 'Dishwasher safe. Microwave safe.',
    careInstructionsEn: 'Dishwasher safe. Microwave safe.',
    categoryName: 'Art & Crafts',
  },
];

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
  } else {
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

async function getOrCreateCategory(db: Firestore, categoryName: string): Promise<string> {
  // Try to find existing category (check both name and nameEn)
  const allCategories = await db.collection('categories').get();
  let existingCategory = null;
  
  for (const doc of allCategories.docs) {
    const data = doc.data();
    if ((data.name === categoryName || data.nameEn === categoryName) && data.isActive !== false) {
      existingCategory = { id: doc.id, ...data };
      break;
    }
  }

  if (existingCategory) {
    // Update if needed
    if (existingCategory.isActive === false) {
      await db.collection('categories').doc(existingCategory.id).update({
        isActive: true,
        updatedAt: Timestamp.now(),
      });
      console.log(`🔄 Reactivated category: ${categoryName}`);
    }
    return existingCategory.id;
  }

  // Create new category
  const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const now = Timestamp.now();
  
  const categoryRef = db.collection('categories').doc();
  await categoryRef.set({
    name: categoryName,
    nameEn: categoryName,
    slug: slug,
    description: `Category for ${categoryName}`,
    descriptionEn: `Category for ${categoryName}`,
    parentId: null,
    image: PLACEHOLDER_IMAGES[0],
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✅ Created category: ${categoryName}`);
  return categoryRef.id;
}

async function getSellerUsers(db: Firestore): Promise<Array<{ id: string; email: string }>> {
  const sellersSnapshot = await db.collection('users')
    .where('role', '==', 'seller')
    .where('isActive', '==', true)
    .get();

  if (sellersSnapshot.empty) {
    throw new Error('No seller users found. Please run seed-users script first.');
  }

  return sellersSnapshot.docs.map(doc => ({
    id: doc.id,
    email: doc.data().email || 'unknown',
  }));
}

async function seedProducts() {
  try {
    console.log('🌱 Starting product seeding...\n');

    const db = initializeFirebase();

    // Get seller users
    const sellers = await getSellerUsers(db);
    console.log(`📦 Found ${sellers.length} seller(s)\n`);

    if (sellers.length === 0) {
      throw new Error('No sellers found. Please seed users first.');
    }

    let created = 0;
    let skipped = 0;

    // Create categories and products
    for (let i = 0; i < testProducts.length; i++) {
      const productData = testProducts[i];
      const seller = sellers[i % sellers.length]; // Distribute products among sellers

      try {
        // Get or create category
        const categoryId = await getOrCreateCategory(db, productData.categoryName);

        // Generate slug
        const slug = productData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        // Check if product with same title already exists
        const existingProduct = await db.collection('products')
          .where('title', '==', productData.title)
          .where('sellerId', '==', seller.id)
          .limit(1)
          .get();

        if (!existingProduct.empty) {
          const existing = existingProduct.docs[0];
          const existingData = existing.data();
          
          // Check if product needs update (e.g., stock, price changes)
          const needsUpdate = 
            existingData.stock !== productData.stock ||
            existingData.price !== productData.price ||
            existingData.isActive === false ||
            existingData.moderationStatus !== ModerationStatus.APPROVED;
          
          if (needsUpdate) {
            await db.collection('products').doc(existing.id).update({
              stock: productData.stock,
              price: productData.price,
              discountPrice: productData.discountPrice || null,
              isActive: true,
              moderationStatus: ModerationStatus.APPROVED,
              updatedAt: Timestamp.now(),
            });
            console.log(`🔄 Updated product: "${productData.title}" - Seller: ${seller.email}`);
            created++; // Count as created/updated
          } else {
            console.log(`⏭️  Product "${productData.title}" already exists for seller ${seller.email}, skipping...`);
            skipped++;
          }
          continue;
        }

        // Create product document
        const now = Timestamp.now();
        const productRef = db.collection('products').doc();
        
        const productDoc: any = {
          title: productData.title,
          titleEn: productData.titleEn,
          description: productData.description,
          descriptionEn: productData.descriptionEn,
          categoryId,
          sellerId: seller.id,
          price: productData.price,
          discountPrice: productData.discountPrice || null,
          stock: productData.stock,
          material: productData.material,
          weight: productData.weight,
          dimensions: productData.dimensions,
          careInstructions: productData.careInstructions,
          careInstructionsEn: productData.careInstructionsEn,
          slug: `${slug}-${Date.now()}`,
          images: PLACEHOLDER_IMAGES.map((url, index) => ({
            url,
            sortOrder: index,
          })),
          moderationStatus: ModerationStatus.APPROVED, // Auto-approve for testing
          averageRating: 0,
          totalReviews: 0,
          totalSales: 0,
          views: 0,
          isActive: true,
          isFeatured: i < 3, // First 3 products are featured
          createdAt: now,
          updatedAt: now,
        };

        // Add variants if they exist
        if (productData.variants && productData.variants.length > 0) {
          productDoc.variants = productData.variants;
        }

        await productRef.set(productDoc);

        console.log(`✅ Created product: "${productData.title}" (${productData.categoryName}) - Seller: ${seller.email}`);
        created++;
      } catch (error: any) {
        console.error(`❌ Error creating product "${productData.title}":`, error.message);
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Created: ${created} products`);
    console.log(`⏭️  Skipped: ${skipped} products (already exist)`);
    console.log('✨ Product seeding completed!\n');

    // Only exit if run directly (not imported)
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error; // Re-throw to allow caller to handle
  }
}

// Run if executed directly
if (require.main === module) {
  seedProducts();
}

export { seedProducts };

