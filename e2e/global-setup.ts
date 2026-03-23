import { resetProductStore, SEED_PRODUCTS, seedProducts } from './helpers/api';

/**
 * GLOBAL SETUP — runs ONCE before all tests.
 *
 * :
 * Global setup is NOT the same as per-test setup.
 * - Global setup: runs once, for the entire suite (heavy setup like seeding baseline data)
 * - Fixtures: run before/after each test (lightweight, test-specific data)
 *
 * Here we reset the in-memory store and seed 3 known products.
 * Tests that rely on "Laptop Pro", "Desk Chair", "Coffee Maker" existing can count on them.
 * Tests that need their own isolated data use the `createdProduct` fixture instead.
 */
export default async function globalSetup() {
  console.log('\n🌱 Global setup: resetting and seeding product store...');

  await resetProductStore();
  await seedProducts(SEED_PRODUCTS);

  console.log(`✅ Seeded ${SEED_PRODUCTS.length} products.\n`);
}
