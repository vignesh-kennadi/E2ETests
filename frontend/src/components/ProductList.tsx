import type { Product } from '../types/product';
import { ProductCard } from './ProductCard';

interface ProductListProps {
  products: Product[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isAuthenticated: boolean;
  onReorder?: (draggedId: string, targetId: string) => void;
}

export function ProductList({ products, onEdit, onDelete, isAuthenticated, onReorder }: ProductListProps) {
  let draggedId = '';

  if (products.length === 0) {
    return (
      <p data-testid="empty-state" style={{ color: '#6b7280', marginTop: 32, textAlign: 'center' }}>
        No products found. Add your first product!
      </p>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          <th style={{ padding: '10px 8px', textAlign: 'left', width: 56 }}>Image</th>
          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Name</th>
          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Category</th>
          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Price</th>
          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Description</th>
          {isAuthenticated && <th style={{ padding: '10px 8px', textAlign: 'left' }}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={onEdit}
            onDelete={onDelete}
            isAuthenticated={isAuthenticated}
            onDragStart={(id) => { draggedId = id; }}
            onDrop={(targetId) => {
              if (draggedId && draggedId !== targetId && onReorder) {
                onReorder(draggedId, targetId);
                draggedId = '';
              }
            }}
          />
        ))}
      </tbody>
    </table>
  );
}
