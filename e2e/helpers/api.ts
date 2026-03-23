/**
 * Direct API helpers for use in global-setup, auth.setup, and fixtures.
 *
 * :
 * Never set up test data through the UI if the API exists.
 * UI-based setup is slow (browser overhead) and brittle (depends on UI working).
 * These helpers call the backend directly with fetch — fast and reliable.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5000';
export const STATIC_TOKEN = 'demo-static-token-12345';

export interface ProductDto {
  name: string;
  category: string;
  description?: string;
  price: number;
  imageUrl?: string;
}

export interface Product extends ProductDto {
  id: string;
  sortOrder: number;
  createdAt: string;
}

export async function resetProductStore(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/test/reset`, { method: 'POST' });
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
}

export async function seedProducts(products: ProductDto[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/test/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(products),
  });
  if (!res.ok) throw new Error(`Seed failed: ${res.status}`);
}

export async function createProduct(dto: ProductDto): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STATIC_TOKEN}`,
    },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Create failed: ${res.status} — ${body.title ?? ''}`);
  }
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STATIC_TOKEN}` },
  });
  // Swallow errors (product may already be gone — that's fine for cleanup)
}

export async function getAllProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error(`GetAll failed: ${res.status}`);
  return res.json();
}

/** Seed data used for all tests. Known products tests can rely on. */
export const SEED_PRODUCTS: ProductDto[] = [
  {
    name: 'Laptop Pro',
    category: 'Electronics',
    description: 'High-performance laptop for professionals.',
    price: 1299.99,
    imageUrl: 'https://placehold.co/40x40?text=LP',
  },
  {
    name: 'Desk Chair',
    category: 'Furniture',
    description: 'Ergonomic office chair with lumbar support.',
    price: 349.00,
    imageUrl: 'https://placehold.co/40x40?text=DC',
  },
  {
    name: 'Coffee Maker',
    category: 'Appliances',
    description: 'Programmable 12-cup coffee maker.',
    price: 89.99,
    imageUrl: 'https://placehold.co/40x40?text=CM',
  },
];
