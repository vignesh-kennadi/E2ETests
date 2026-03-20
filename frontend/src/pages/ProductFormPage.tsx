import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '../api/productsApi';
import { useAuth } from '../context/AuthContext';
import type { CreateProductDto } from '../types/product';

interface ProductFormPageProps {
  mode: 'create' | 'edit';
}

export function ProductFormPage({ mode }: ProductFormPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(mode === 'edit');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) navigate('/login');
  }, [isLoggedIn, navigate]);

  // In edit mode: fetch existing product and pre-fill the form
  useEffect(() => {
    if (mode === 'edit' && id) {
      productsApi
        .getById(id)
        .then((product) => {
          setName(product.name);
          setCategory(product.category);
          setPrice(String(product.price));
          setDescription(product.description);
          setImageUrl(product.imageUrl ?? '');
        })
        .catch(() => setError('Could not load product.'))
        .finally(() => setFetchLoading(false));
    }
  }, [mode, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const priceNum = parseFloat(price);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!category.trim()) { setError('Category is required.'); return; }
    if (isNaN(priceNum) || priceNum < 0) { setError('Price must be a non-negative number.'); return; }

    const dto: CreateProductDto = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: priceNum,
      imageUrl: imageUrl.trim() || undefined,
    };

    setLoading(true);
    try {
      if (mode === 'create') {
        await productsApi.create(dto);
      } else if (id) {
        await productsApi.update(id, dto);
      }
      navigate('/');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFileName(file.name);
      setImageUrl(`/uploads/${file.name}`);
    } else {
      setImageFileName('');
    }
  };

  if (fetchLoading) {
    return <p data-testid="loading-indicator" style={{ padding: 24 }}>Loading…</p>;
  }

  return (
    <div data-testid="product-form-page" style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h1>{mode === 'create' ? 'Add Product' : 'Edit Product'}</h1>

      <form onSubmit={handleSubmit} noValidate style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="field-name" style={{ display: 'block', marginBottom: 4 }}>
            Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="field-name"
            data-testid="field-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="field-category" style={{ display: 'block', marginBottom: 4 }}>
            Category <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="field-category"
            data-testid="field-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Electronics"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="field-price" style={{ display: 'block', marginBottom: 4 }}>
            Price (USD) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="field-price"
            data-testid="field-price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="field-description" style={{ display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            id="field-description"
            data-testid="field-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional product description"
            rows={3}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="field-image-url" style={{ display: 'block', marginBottom: 4 }}>Image URL</label>
          <input
            id="field-image-url"
            data-testid="field-image-url"
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Or upload image</label>
          <input
            ref={fileInputRef}
            data-testid="field-image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
          {imageFileName && (
            <p style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>Selected: {imageFileName}</p>
          )}
        </div>

        {error && (
          <p data-testid="form-error" style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            data-testid="submit-product-form"
            type="submit"
            disabled={loading}
            style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {loading ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Update Product'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ padding: '10px 24px' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
