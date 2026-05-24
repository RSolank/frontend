import { Link, useRouteError } from 'react-router-dom';

// Per-route errorElement for the auth feature. Renders inside the app
// shell, so the user keeps the brand header + theme toggle while seeing
// a friendly recovery prompt.
export function AuthErrorFallback() {
  const error = useRouteError() as { message?: string } | null;
  const message =
    (error && typeof error.message === 'string' && error.message) ||
    'Something went wrong on the auth page.';

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '3rem auto',
        padding: '2rem',
        border: '1px solid #fecaca',
        background: '#fef2f2',
        borderRadius: 8,
        color: '#991b1b',
      }}
    >
      <h2 style={{ marginTop: 0 }}>Authentication error</h2>
      <p>{message}</p>
      <p>
        <Link to="/login">Return to login</Link>
      </p>
    </div>
  );
}
