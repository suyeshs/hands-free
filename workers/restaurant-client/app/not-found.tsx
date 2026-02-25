export const runtime = 'nodejs';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>404</h1>
      <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Page Not Found</h2>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        The page you are looking for does not exist.
      </p>
      <a
        href="/"
        style={{
          color: '#0070f3',
          textDecoration: 'none',
          padding: '10px 20px',
          border: '1px solid #0070f3',
          borderRadius: '5px'
        }}
      >
        Go Home
      </a>
    </div>
  );
}
