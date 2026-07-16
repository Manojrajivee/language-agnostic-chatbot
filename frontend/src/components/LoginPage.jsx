import { useState } from 'react';
import { login, signup } from '../services/api';
import logo from '../assets/logo.png';

/**
 * LoginPage — standalone login/signup page with a premium glassmorphic interface.
 */
export default function LoginPage({ onAuthSuccess, navigateTo }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await login(username, password);
        onAuthSuccess(data);
        navigateTo('chat');
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
    <div className="login-page-container">
      {/* Background Glow Orbs */}
      <div className="bg-glow-orb orb-1"></div>
      <div className="bg-glow-orb orb-2"></div>

      <div className="login-card glass-card">
        {/* Brand Header */}
        <div className="login-brand" onClick={() => navigateTo('chat')} style={{ cursor: 'pointer' }}>
          <img src={logo} alt="LinguaBot Logo" className="login-logo-img" />
          <h2>LinguaBot</h2>
          <p>Multi-lingual AI Platform</p>
        </div>

        {/* Mode Tabs (Only for standard Login / Signup) */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="auth-tabs login-page-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Log In
            </button>
            <button
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
            >
              Sign Up
            </button>
          </div>
        )}

        {error && <div className="auth-error login-error">{error}</div>}
        
        {message && (
          <div className="auth-message-success login-success-message">
            {message}
          </div>
        )}

        {/* ── Standard Auth Forms ──────────────────────── */}
        {(mode === 'login' || mode === 'signup') && (
          <form onSubmit={handleAuthSubmit} className="auth-form login-form">
            <div className="form-group">
              <label htmlFor="auth-username">Username</label>
              <input
                type="text"
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter username"
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
                  placeholder="Enter email address"
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
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Cancel Button */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 20, paddingTop: 16, textAlign: 'center' }}>
          <button 
            type="button"
            className="cancel-auth-btn"
            onClick={() => navigateTo('chat')}
          >
            ← Back to Chat Platform
          </button>
        </div>
      </div>
    </div>
  );
}
