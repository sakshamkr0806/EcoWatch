import { Link } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState';

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
      <EmptyState
        icon="search"
        title="404 — page not found"
        message="The page you are looking for does not exist or has been moved."
        action={
          <Link to="/" className="btn btn-primary mt-10">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
