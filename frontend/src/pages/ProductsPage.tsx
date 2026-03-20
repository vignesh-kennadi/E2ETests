import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productsApi } from '../api/productsApi';
import { ProductList } from '../components/ProductList';
import { ProductSearchBar } from '../components/ProductSearchBar';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../types/product';

export function ProductsPage() {
  const { isLoggedIn, username, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const initialQuery = searchParams.get('q') ?? '';
  const initialCategory = searchParams.get('category') ?? 'All';

  useEffect(() => {
    productsApi
      .getAll()
      .then((data) => {
        setProducts(data);
        setFilteredProducts(filterProducts(data, initialQuery, initialCategory));
      })
      .catch(() => setError('Failed to load products. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  const filterProducts = (all: Product[], query: string, category: string) => {
    return all.filter((p) => {
      const matchesQuery = !query || p.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === 'All' || p.category === category;
      return matchesQuery && matchesCategory;
    });
  };

  const handleSearch = useCallback((query: string, category: string) => {
    // Update URL params so the filter state survives a page refresh
    const params: Record<string, string> = {};
    if (query) params['q'] = query;
    if (category !== 'All') params['category'] = category;
    setSearchParams(params, { replace: true });
    setFilteredProducts(filterProducts(products, query, category));
  }, [products, setSearchParams]);

  const handleDelete = async (id: string) => {
    await productsApi.delete(id);
    const updated = products.filter((p) => p.id !== id);
    setProducts(updated);
    setFilteredProducts(filterProducts(updated, initialQuery, initialCategory));
  };

  const handleReorder = async (draggedId: string, targetId: string) => {
    const draggedIndex = products.findIndex((p) => p.id === draggedId);
    const targetIndex = products.findIndex((p) => p.id === targetId);
    const reordered = [...products];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    const updated = reordered.map((p, i) => ({ ...p, sortOrder: i }));
    setProducts(updated);
    setFilteredProducts(filterProducts(updated, initialQuery, initialCategory));
    await productsApi.reorder(updated.map((p) => ({ id: p.id, sortOrder: p.sortOrder })));
  };

  return (
    <div data-testid="products-page" style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Product Catalog</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {isLoggedIn ? (
            <>
              <span style={{ color: '#6b7280' }}>Logged in as <strong>{username}</strong></span>
              <button
                data-testid="logout-btn"
                onClick={logout}
                style={{ padding: '6px 14px' }}
              >
                Logout
              </button>
              <button
                data-testid="add-product-btn"
                onClick={() => navigate('/products/new')}
                style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}
              >
                Add Product
              </button>
            </>
          ) : (
            <button
              data-testid="login-link"
              onClick={() => navigate('/login')}
              style={{ padding: '6px 14px' }}
            >
              Login
            </button>
          )}
        </div>
      </div>

      <ProductSearchBar
        onSearch={handleSearch}
        initialQuery={initialQuery}
        initialCategory={initialCategory}
      />

      {loading && (
        <p data-testid="loading-indicator" style={{ color: '#6b7280' }}>Loading products…</p>
      )}

      {error && (
        <p data-testid="error-message" style={{ color: '#dc2626' }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          <p data-testid="product-count" style={{ color: '#6b7280', marginBottom: 8 }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          </p>
          <ProductList
            products={filteredProducts}
            onEdit={(id) => navigate(`/products/${id}/edit`)}
            onDelete={handleDelete}
            isAuthenticated={isLoggedIn}
            onReorder={isLoggedIn ? handleReorder : undefined}
          />
        </>
      )}
    </div>
  );
}
