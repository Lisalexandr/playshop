import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Category, type ProductPage } from '../api';
import ProductCard from '../components/ProductCard';

/** Time left until local midnight – a good target for Playwright's page.clock API. */
function useCountdownToMidnight() {
  const calc = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  };
  const [seconds, setSeconds] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setSeconds(calc()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<ProductPage | null>(null);
  const countdown = useCountdownToMidnight();

  useEffect(() => {
    api<Category[]>('/categories').then(setCategories);
    api<ProductPage>('/products?featured=true').then(setFeatured);
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Welcome to PlayShop</h1>
          <p>Everything you need to practice end-to-end testing – and a few things you might actually want.</p>
          <Link to="/products" className="btn btn-primary btn-lg">
            Shop now
          </Link>
        </div>
        <aside className="deal" aria-label="Deal of the day">
          <span className="deal-label">⚡ Deal of the day</span>
          <strong>Aurora Wireless Headphones</strong>
          <span>
            Ends in <time data-testid="deal-countdown">{countdown}</time>
          </span>
          <Link to="/products/1">View deal →</Link>
        </aside>
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading">Shop by category</h2>
        <div className="category-grid">
          {categories.map((c) => (
            <Link key={c.id} to={`/products?category=${c.id}`} className="category-tile" data-testid="category-tile">
              <span className="category-emoji">{c.emoji}</span>
              <span>{c.name}</span>
              <small className="muted">
                {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
              </small>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading">Featured products</h2>
        <div className="product-grid">
          {featured?.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
