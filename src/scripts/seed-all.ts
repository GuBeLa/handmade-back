import { seedUsers } from './seed-users';
import { seedProducts } from './seed-products';

/**
 * Master seed script - seeds both users and products
 * Safe to run multiple times (idempotent)
 */
async function seedAll() {
  try {
    console.log('🌱 Starting full database seeding...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Seed users
    console.log('📝 Step 1: Seeding users...\n');
    await seedUsers();
    console.log('\n');

    // Step 2: Seed products (requires users to exist)
    console.log('📦 Step 2: Seeding products...\n');
    await seedProducts();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Full database seeding completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedAll();
}

export { seedAll };

