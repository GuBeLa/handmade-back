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

// Initialize Firebase Admin
let db: Firestore;

if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in .env');
  }

  const serviceAccountKey = JSON.parse(serviceAccount);
  initializeApp({
    credential: cert(serviceAccountKey),
  });
  db = getFirestore();
} else {
  db = getFirestore();
}

enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

enum PaymentMethod {
  PAYZE = 'payze',
  COD_CASH = 'cod_cash',
}

enum DeliveryMethod {
  COURIER = 'courier',
  PICKUP = 'pickup',
}

async function seedOrders() {
  console.log('🌱 Starting order seeding...\n');

  try {
    // Get test users
    const usersSnapshot = await db.collection('users').limit(10).get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const buyers = users.filter((u: any) => u.role === 'buyer');
    const sellers = users.filter((u: any) => u.role === 'seller');

    if (buyers.length === 0 || sellers.length === 0) {
      console.log('⚠️  No buyers or sellers found. Please run seed:comprehensive first.');
      return;
    }

    // Get products
    const productsSnapshot = await db.collection('products').where('isActive', '==', true).limit(20).get();
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (products.length === 0) {
      console.log('⚠️  No products found. Please run seed:products first.');
      return;
    }

    const testOrders = [
      {
        buyer: buyers[0],
        items: [
          { product: products[0], quantity: 2 },
          { product: products[1], quantity: 1 },
        ],
        paymentMethod: PaymentMethod.PAYZE,
        deliveryMethod: DeliveryMethod.COURIER,
        deliveryAddress: 'თბილისი, რუსთაველის გამზირი 15, ბინა 42',
        deliveryRegion: 'Tbilisi',
        deliveryPhone: '+995555111111',
        deliveryNotes: 'გთხოვთ დარეკოთ ზუსტად 14:00-ზე',
        status: OrderStatus.CONFIRMED,
        isPaid: true,
      },
      {
        buyer: buyers[1],
        items: [
          { product: products[2], quantity: 1 },
        ],
        paymentMethod: PaymentMethod.PAYZE,
        deliveryMethod: DeliveryMethod.PICKUP,
        deliveryAddress: 'თვით-გატანა',
        deliveryRegion: 'Tbilisi',
        deliveryPhone: '+995555222222',
        status: OrderStatus.PENDING,
        isPaid: true,
      },
      {
        buyer: buyers[0],
        items: [
          { product: products[3], quantity: 3 },
          { product: products[4], quantity: 1 },
        ],
        paymentMethod: PaymentMethod.PAYZE,
        deliveryMethod: DeliveryMethod.COURIER,
        deliveryAddress: 'თბილისი, აღმაშენებლის გამზირი 42, ბინა 12',
        deliveryRegion: 'Tbilisi',
        deliveryPhone: '+995555111111',
        status: OrderStatus.PROCESSING,
        isPaid: true,
      },
      {
        buyer: buyers[2] || buyers[0],
        items: [
          { product: products[5], quantity: 1 },
        ],
        paymentMethod: PaymentMethod.PAYZE,
        deliveryMethod: DeliveryMethod.COURIER,
        deliveryAddress: 'თბილისი, ვაზისუბნის ქუჩა 5',
        deliveryRegion: 'Tbilisi',
        deliveryPhone: '+995555333333',
        status: OrderStatus.SHIPPED,
        isPaid: true,
        shippedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        buyer: buyers[1],
        items: [
          { product: products[6], quantity: 2 },
          { product: products[7], quantity: 1 },
        ],
        paymentMethod: PaymentMethod.PAYZE,
        deliveryMethod: DeliveryMethod.PICKUP,
        deliveryAddress: 'თვით-გატანა',
        deliveryRegion: 'Tbilisi',
        deliveryPhone: '+995555222222',
        status: OrderStatus.DELIVERED,
        isPaid: true,
        deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
    ];

    let createdCount = 0;

    for (const orderData of testOrders) {
      try {
        // Calculate order totals
        let subtotal = 0;
        const orderItems: any[] = [];

        for (const item of orderData.items) {
          const product = item.product as any;
          const price = product.discountPrice || product.price;
          const itemTotal = price * item.quantity;
          subtotal += itemTotal;

          orderItems.push({
            productId: product.id,
            productTitle: product.title,
            productImage: product.images?.[0]?.url,
            price,
            quantity: item.quantity,
            total: itemTotal,
          });
        }

        const deliveryFee = orderData.deliveryMethod === DeliveryMethod.PICKUP ? 0 : 10;
        const commissionRate = 0.1; // 10%
        const commission = subtotal * commissionRate;
        const total = subtotal + deliveryFee;

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create order
        const orderRef = await db.collection('orders').add({
          orderNumber,
          buyerId: orderData.buyer.id,
          items: orderItems,
          subtotal,
          deliveryFee,
          commission,
          total,
          paymentMethod: orderData.paymentMethod,
          deliveryMethod: orderData.deliveryMethod,
          deliveryAddress: orderData.deliveryAddress,
          deliveryRegion: orderData.deliveryRegion,
          deliveryPhone: orderData.deliveryPhone,
          deliveryNotes: orderData.deliveryNotes || null,
          status: orderData.status,
          isPaid: orderData.isPaid,
          shippedAt: orderData.shippedAt ? Timestamp.fromDate(orderData.shippedAt) : null,
          deliveredAt: orderData.deliveredAt ? Timestamp.fromDate(orderData.deliveredAt) : null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        console.log(`✅ Created order: ${orderNumber} (${orderData.status})`);
        createdCount++;
      } catch (error: any) {
        console.error(`❌ Error creating order:`, error.message);
      }
    }

    console.log(`\n✨ Successfully created ${createdCount} test orders!`);
  } catch (error: any) {
    console.error('❌ Error seeding orders:', error);
    throw error;
  }
}

// Run the seed function
seedOrders()
  .then(() => {
    console.log('\n🎉 Order seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

