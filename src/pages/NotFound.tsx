import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="empty-state" data-testid="not-found">
      <h1>404 – Page not found</h1>
      <p>We couldn’t find the page you were looking for.</p>
      <Link to="/" className="btn btn-primary">
        Go to homepage
      </Link>
    </section>
  );
}
