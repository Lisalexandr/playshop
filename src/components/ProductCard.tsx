import { Link } from 'react-router-dom';
import { money, type Product } from '../api';
import { useCart } from '../context/useCart';
import { useToast } from '../context/useToast';

export function Rating({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="rating" aria-label={`Rated ${value} out of 5`} title={`${value} / 5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)} <span className="muted">{value.toFixed(1)}</span>
    </span>
  );
}

export function Price({ product }: { product: Product }) {
  return (
    <span className="price">
      <span data-testid="price">{money(product.price)}</span>
      {product.originalPrice && (
        <>
          {' '}
          <s className="muted" data-testid="original-price">
            {money(product.originalPrice)}
          </s>
          <span className="sale-badge">-{Math.round((1 - product.price / product.originalPrice) * 100)}%</span>
        </>
      )}
    </span>
  );
}

export function ProductImage({ product, size = 'md' }: { product: Pick<Product, 'emoji' | 'color' | 'name'>; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`product-image product-image-${size}`} style={{ background: product.color }} role="img" aria-label={product.name}>
      {product.emoji}
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const toast = useToast();
  const outOfStock = product.stock === 0;

  return (
    <article className="product-card" data-testid="product-card" data-product-id={product.id}>
      <Link to={`/products/${product.id}`} tabIndex={-1} aria-hidden="true">
        <ProductImage product={product} />
      </Link>
      <div className="product-card-body">
        <h3 className="product-name">
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <Rating value={product.rating} />
        <Price product={product} />
        {outOfStock ? (
          <button className="btn" disabled>
            Out of stock
          </button>
        ) : product.options ? (
          <Link className="btn btn-secondary" to={`/products/${product.id}`}>
            Choose options
          </Link>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              add(product, 1, null);
              toast(`Added "${product.name}" to cart`);
            }}
          >
            Add to cart
          </button>
        )}
      </div>
    </article>
  );
}
