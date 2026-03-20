import { useState } from 'react';
import type { Product } from '../types/product';
import { ConfirmDialog } from './ConfirmDialog';

interface ProductCardProps {
  product: Product;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isAuthenticated: boolean;
  // drag-and-drop handlers
  onDragStart?: (id: string) => void;
  onDrop?: (targetId: string) => void;
}

export function ProductCard({ product, onEdit, onDelete, isAuthenticated, onDragStart, onDrop }: ProductCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteConfirm = () => {
    setShowConfirm(false);
    onDelete(product.id);
  };

  return (
    <>
      <tr
        data-testid={`product-row-${product.id}`}
        draggable={isAuthenticated}
        onDragStart={() => onDragStart?.(product.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop?.(product.id)}
        style={{ borderBottom: '1px solid #e5e7eb' }}
      >
        <td style={{ padding: '12px 8px' }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              // alt uses product name — enables getByAltText() in Playwright
              alt={product.name}
              data-testid={`product-image-${product.id}`}
              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
            />
          ) : (
            <div style={{ width: 40, height: 40, background: '#f3f4f6', borderRadius: 4 }} />
          )}
        </td>
        <td data-testid={`product-name-${product.id}`} style={{ padding: '12px 8px', fontWeight: 500 }}>
          {product.name}
        </td>
        <td style={{ padding: '12px 8px' }}>{product.category}</td>
        <td data-testid={`product-price-${product.id}`} style={{ padding: '12px 8px' }}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price)}
        </td>
        <td style={{ padding: '12px 8px', color: '#6b7280' }}>{product.description}</td>
        {isAuthenticated && (
          <td style={{ padding: '12px 8px' }}>
            <button
              data-testid={`edit-product-${product.id}`}
              onClick={() => onEdit(product.id)}
              title="Edit product"
              style={{ marginRight: 8, padding: '4px 12px' }}
            >
              Edit
            </button>
            <button
              data-testid={`delete-product-${product.id}`}
              onClick={() => setShowConfirm(true)}
              title="Delete product"
              style={{ padding: '4px 12px', background: '#fee2e2', border: 'none', borderRadius: 4 }}
            >
              Delete
            </button>
          </td>
        )}
      </tr>

      {showConfirm && (
        <ConfirmDialog
          message={`Delete "${product.name}"? This cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
