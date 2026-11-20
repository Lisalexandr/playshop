import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, type Category, type Product } from '../api';
import { Price, ProductImage, Rating } from '../components/ProductCard';
import { MAX_QTY, useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

export default function ProductDetail() {
  const { id } = useParams();
  const { add, items } = useCart();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qty, setQty] = useState(1);
  const [option, setOption] = useState('');
  const [optionError, setOptionError] = useState('');
  const [tab, setTab] = useState<'description' | 'reviews'>('description');

  useEffect(() => {
    setProduct(null);
    setNotFound(false);
    setQty(1);
    setOption('');
    api<Product>(`/products/${id}`)
      .then(async (p) => {
        setProduct(p);
        const cats = await api<Category[]>('/categories');
        setCategory(cats.find((c) => c.id === p.category) ?? null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
  }, [id]);

  if (notFound) {
    return (
      <section className="empty-state" data-testid="product-not-found">
        <h1>Product not found</h1>
        <p>The product you are looking for does not exist.</p>
        <Link to="/products" className="btn btn-primary">
          Back to products
        </Link>
      </section>
    );
  }
  if (!product) {
    return (
      <div className="spinner" role="progressbar" aria-label="Loading product">
        Loading…
      </div>
    );
  }

  const inCart = items.filter((i) => i.productId === product.id).reduce((n, i) => n + i.qty, 0);
  const maxQty = Math.max(1, Math.min(MAX_QTY, product.stock));
  const outOfStock = product.stock === 0;

  const stockLabel = outOfStock
    ? 'Out of stock'
    : product.stock <= 5
      ? `Only ${product.stock} left in stock – order soon!`
      : 'In stock';

  const onAdd = () => {
    if (product.options && !option) {
      setOptionError(`Please select a ${product.options.name.toLowerCase()}`);
      return;
    }
    add(product, qty, product.options ? option : null);
    toast(`Added ${qty} × "${product.name}" to cart`);
  };

  return (
    <article className="product-detail" data-testid="product-detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> / <Link to="/products">Products</Link> /{' '}
        {category && <Link to={`/products?category=${category.id}`}>{category.name}</Link>} /{' '}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail-grid">
        <ProductImage product={product} size="lg" />

        <div className="product-info">
          <h1>{product.name}</h1>
          <Rating value={product.rating} />
          <span className="muted"> ({product.reviews.length} reviews)</span>
          <p className="price-lg">
            <Price product={product} />
          </p>
          <p className={`stock ${outOfStock ? 'stock-out' : product.stock <= 5 ? 'stock-low' : 'stock-in'}`} data-testid="stock-status">
            {stockLabel}
          </p>

          {product.options && (
            <div className="field">
              <label htmlFor="option">{product.options.name}</label>
              <select
                id="option"
                value={option}
                aria-invalid={Boolean(optionError)}
                onChange={(e) => {
                  setOption(e.target.value);
                  setOptionError('');
                }}
              >
                <option value="">Select {product.options.name.toLowerCase()}</option>
                {product.options.values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              {optionError && (
                <p className="error-text" role="alert">
                  {optionError}
                </p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="qty">Quantity</label>
            <div className="qty-stepper">
              <button aria-label="Decrease quantity" disabled={qty <= 1 || outOfStock} onClick={() => setQty((q) => q - 1)}>
                −
              </button>
              <input
                id="qty"
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                disabled={outOfStock}
                onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
              />
              <button aria-label="Increase quantity" disabled={qty >= maxQty || outOfStock} onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" disabled={outOfStock} onClick={onAdd}>
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </button>
          {inCart > 0 && (
            <p className="muted" data-testid="in-cart-note">
              {inCart} in your <Link to="/cart">cart</Link>
            </p>
          )}

          <ul className="features">
            {product.features.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="tabs">
        <div role="tablist" aria-label="Product information">
          <button role="tab" aria-selected={tab === 'description'} onClick={() => setTab('description')}>
            Description
          </button>
          <button role="tab" aria-selected={tab === 'reviews'} onClick={() => setTab('reviews')}>
            Reviews ({product.reviews.length})
          </button>
        </div>
        <div role="tabpanel">
          {tab === 'description' ? (
            <p>{product.description}</p>
          ) : (
            <ul className="reviews">
              {product.reviews.map((r, i) => (
                <li key={i} data-testid="review">
                  <Rating value={r.rating} /> <strong>{r.author}</strong>
                  <p>{r.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
