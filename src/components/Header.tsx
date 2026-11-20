import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Category } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => setMenuOpen(false), [location]);
  useEffect(() => setQuery(params.get('q') ?? ''), [params]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };

  const onLogout = async () => {
    await logout();
    toast('You have been signed out', 'info');
    navigate('/');
  };

  const activeCategory = location.pathname === '/products' ? params.get('category') : null;

  return (
    <header className="site-header">
      <div className="container header-top">
        <Link to="/" className="logo" aria-label="PlayShop home">
          🛒 Play<span>Shop</span>
        </Link>

        <form className="search" role="search" onSubmit={onSearch}>
          <input
            type="search"
            name="q"
            placeholder="Search products…"
            aria-label="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>

        <nav className="header-actions" aria-label="Account">
          {user ? (
            <div className="user-menu" ref={menuRef}>
              <button
                className="user-menu-button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                data-testid="user-menu-button"
              >
                Hi, {user.name.split(' ')[0]} ▾
              </button>
              {menuOpen && (
                <ul className="dropdown" role="menu">
                  <li role="none">
                    <Link role="menuitem" to="/account">
                      My account
                    </Link>
                  </li>
                  <li role="none">
                    <Link role="menuitem" to="/orders">
                      My orders
                    </Link>
                  </li>
                  {user.role === 'admin' && (
                    <li role="none">
                      <Link role="menuitem" to="/admin">
                        Admin panel
                      </Link>
                    </li>
                  )}
                  <li role="none">
                    <button role="menuitem" onClick={onLogout}>
                      Sign out
                    </button>
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn-ghost">
              Sign in
            </Link>
          )}
          <Link to="/cart" className="cart-link" aria-label={`Cart, ${count} items`}>
            🛒 Cart
            <span className="badge" data-testid="cart-count">
              {count}
            </span>
          </Link>
        </nav>
      </div>

      <nav className="category-nav" aria-label="Categories">
        <div className="container">
          <NavLink to="/products" end className={() => (location.pathname === '/products' && !activeCategory ? 'active' : '')}>
            All products
          </NavLink>
          {categories.map((c) => (
            <Link key={c.id} to={`/products?category=${c.id}`} className={activeCategory === c.id ? 'active' : ''}>
              {c.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
