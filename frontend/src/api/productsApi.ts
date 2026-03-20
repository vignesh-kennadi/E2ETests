import type { CreateProductDto, Product, ReorderItem, UpdateProductDto } from '../types/product';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ title: 'Request failed' }));
    throw { status: response.status, message: body.title ?? body.message ?? 'Request failed', body };
  }

  // 204 No Content has no body
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const productsApi = {
  getAll: () => request<Product[]>('/api/products'),

  getById: (id: string) => request<Product>(`/api/products/${id}`),

  create: (dto: CreateProductDto) =>
    request<Product>('/api/products', { method: 'POST', body: JSON.stringify(dto) }),

  update: (id: string, dto: UpdateProductDto) =>
    request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),

  delete: (id: string) =>
    request<void>(`/api/products/${id}`, { method: 'DELETE' }),

  reorder: (items: ReorderItem[]) =>
    request<void>('/api/products/reorder', { method: 'PUT', body: JSON.stringify(items) }),
};

export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ username: string }>('/api/auth/me'),
};
