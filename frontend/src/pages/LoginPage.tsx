import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="login-page" style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Sign In</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="username" style={{ display: 'block', marginBottom: 4 }}>Username</label>
          <input
            id="username"
            data-testid="login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 4 }}>Password</label>
          <input
            id="password"
            data-testid="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>
        {error && (
          <p data-testid="login-error" style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>
        )}
        <button
          data-testid="login-submit"
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>
        Demo credentials: <strong>admin</strong> / <strong>password</strong>
      </p>
    </div>
  );
}
