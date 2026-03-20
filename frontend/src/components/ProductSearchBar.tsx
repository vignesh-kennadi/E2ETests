import { useEffect, useState } from 'react';

const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Appliances', 'Clothing', 'Books', 'Other'];

interface ProductSearchBarProps {
  onSearch: (query: string, category: string) => void;
  initialQuery?: string;
  initialCategory?: string;
}

export function ProductSearchBar({ onSearch, initialQuery = '', initialCategory = 'All' }: ProductSearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);

  // Debounce: wait 300ms after the user stops typing before firing onSearch.
  // Teaching point: this is a real-world pattern — don't fire an API call on every keystroke.
  // In Playwright tests, use waitForResponse() to wait for the debounced request.
  useEffect(() => {
    const timer = setTimeout(() => onSearch(query, category), 300);
    return () => clearTimeout(timer);
  }, [query, category, onSearch]);

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      <input
        data-testid="search-input"
        type="text"
        placeholder="Search products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search products"
        style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
      />
      <select
        data-testid="category-filter"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Filter by category"
        style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
