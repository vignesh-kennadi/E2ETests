export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  imageUrl?: string;
  sortOrder: number;
  createdAt: string;
}

export type CreateProductDto = Omit<Product, 'id' | 'sortOrder' | 'createdAt'>;
export type UpdateProductDto = Omit<Product, 'id' | 'sortOrder' | 'createdAt'>;

export interface ReorderItem {
  id: string;
  sortOrder: number;
}
