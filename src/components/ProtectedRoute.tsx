import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function ProtectedRoute({ role }: { role?: 'admin' }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="spinner" role="progressbar" aria-label="Loading">
        Loading…
      </div>
    );
  }
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (role && user.role !== role) {
    return (
      <section className="empty-state" data-testid="access-denied">
        <h1>403 – Access denied</h1>
        <p>You do not have permission to view this page.</p>
      </section>
    );
  }
  return <Outlet />;
}
