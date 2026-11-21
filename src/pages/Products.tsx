import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Category, type ProductPage } from '../api';
import ProductCard from '../components/ProductCard';

const PAGE_SIZE = 6;

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'featured';
  const page = Number(params.get('page') ?? '1');
  const inStock = params.get('inStock') === 'true';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const [priceDraft, setPriceDraft] = useState({ min: minPrice, max: maxPrice });

  useEffect(() => {
    api<Category[]>('/categories').then(setCategories);
  }, []);

  const [prevPrice, setPrevPrice] = useState({ min: minPrice, max: maxPrice });
  if (minPrice !== prevPrice.min || maxPrice !== prevPrice.max) {
    setPrevPrice({ min: minPrice, max: maxPrice });
    setPriceDraft({ min: minPrice, max: maxPrice });
  }

  const query = new URLSearchParams({ sort, page: String(page), limit: String(PAGE_SIZE) });
  if (category) query.set('category', category);
  if (q) query.set('q', q);
  if (inStock) query.set('inStock', 'true');
  if (minPrice) query.set('minPrice', minPrice);
  if (maxPrice) query.set('maxPrice', maxPrice);
  const queryString = query.toString();

  const [prevQueryString, setPrevQueryString] = useState(queryString);
  if (queryString !== prevQueryString) {
    setPrevQueryString(queryString);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    api<ProductPage>(`/products?${queryString}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [queryString]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const categoryName = categories.find((c) => c.id === category)?.name;
  const title = q ? `Results for “${q}”` : (categoryName ?? 'All products');

  return (
    <div className="catalog">
      <aside className="filters" aria-label="Filters">
        <fieldset>
          <legend>Category</legend>
          <label>
            <input type="radio" name="category" checked={!category} onChange={() => update({ category: null })} />
            All
          </label>
          {categories.map((c) => (
            <label key={c.id}>
              <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => update({ category: c.id })} />
              {c.name} <span className="muted">({c.productCount})</span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Price</legend>
          <form
            className="price-filter"
            onSubmit={(e) => {
              e.preventDefault();
              update({ minPrice: priceDraft.min, maxPrice: priceDraft.max });
            }}
          >
            <input
              type="number"
              min="0"
              placeholder="Min"
              aria-label="Minimum price"
              value={priceDraft.min}
              onChange={(e) => setPriceDraft((d) => ({ ...d, min: e.target.value }))}
            />
            <span>–</span>
            <input
              type="number"
              min="0"
              placeholder="Max"
              aria-label="Maximum price"
              value={priceDraft.max}
              onChange={(e) => setPriceDraft((d) => ({ ...d, max: e.target.value }))}
            />
            <button type="submit" className="btn btn-secondary">
              Apply
            </button>
          </form>
        </fieldset>

        <fieldset>
          <legend>Availability</legend>
          <label>
            <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? 'true' : null })} />
            In stock only
          </label>
        </fieldset>

        <button className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())} disabled={params.toString() === ''}>
          Clear all filters
        </button>
      </aside>

      <section className="catalog-results">
        <div className="catalog-toolbar">
          <div>
            <h1>{title}</h1>
            <p className="muted" data-testid="results-count" aria-live="polite">
              {data ? `${data.total} ${data.total === 1 ? 'product' : 'products'} found` : ' '}
            </p>
          </div>
          <label className="sort">
            Sort by{' '}
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Customer rating</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}

        {loading && !data ? (
          <div className="spinner" role="progressbar" aria-label="Loading products">
            Loading products…
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="empty-state" data-testid="no-results">
            <p>No products match your filters.</p>
            <button className="btn btn-secondary" onClick={() => setParams(new URLSearchParams())}>
              Reset filters
            </button>
          </div>
        ) : (
          <div className="product-grid" aria-busy={loading}>
            {data?.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
              ← Previous
            </button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                aria-current={n === page ? 'page' : undefined}
                className={n === page ? 'active' : ''}
                onClick={() => update({ page: String(n) })}
              >
                {n}
              </button>
            ))}
            <button disabled={page >= data.totalPages} onClick={() => update({ page: String(page + 1) })}>
              Next →
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
