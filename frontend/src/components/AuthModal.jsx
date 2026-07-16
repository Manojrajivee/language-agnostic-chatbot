import { useState } from 'react';
import { login, signup } from '../services/api';

/**
 * AuthModal — handles user Login and Signup.
 */
export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await login(username, password);
        onAuthSuccess(data);
        onClose();
      } else {
        await signup(username, email, password);
        setMessage("Account Created Successfully");
        setMode('login');
      }
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('[Auth] Error:', err);
      setError(err.response?.data?.error || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal glass-card">
        <button className="auth-close-btn" onClick={onClose} aria-label="Close modal">
          &times;
        </button>

        {/* Mode Tabs (Only for standard Login / Signup) */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Login
            </button>
            <button
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
            >
              Sign Up
            </button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-message-success" style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--success)',
          padding: 12,
          fontSize: 13,
          lineHeight: 1.4,
          textAlign: 'center'
        }}>{message}</div>}

        {/* ── Standard Auth Forms ──────────────────────── */}
        {(mode === 'login' || mode === 'signup') && (
          <form onSubmit={handleAuthSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="auth-username">Username</label>
              <input
                type="text"
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="auth-email">Email Address</label>
                <input
                  type="email"
                  id="auth-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-password">Password</label>
              <input
                type="password"
                id="auth-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Processing...' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
