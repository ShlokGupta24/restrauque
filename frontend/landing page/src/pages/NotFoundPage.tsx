import { Link } from 'react-router-dom';

// A simple 404 fallback page displayed when a user navigates to an invalid URL.
// It helps gracefully recover the user by providing a link back to the homepage.
export default function NotFoundPage() {
  return (
    <main style={{ padding: '4rem', textAlign: 'center', color: '#fff' }}>
      <h1>404 - Not Found</h1>
      <p style={{ marginTop: '1rem', color: '#aaa' }}>The page you are looking for does not exist.</p>
      <Link to="/" style={{ display: 'inline-block', marginTop: '2rem', color: '#E53935' }}>
        ← Back to Home
      </Link>
    </main>
  );
}
