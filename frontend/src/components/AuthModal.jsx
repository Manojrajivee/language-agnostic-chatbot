import { useState } from 'react';
import { login, signup, requestPasswordReset, requestVerificationEmail } from '../services/api';

/**
 * AuthModal — handles user Login, Signup, Forgot Password requests, and Unverified Email alerts.
 */
export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'resend' | 'verify-info'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState('');

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
        setMessage("Account registered! We've sent a verification link. Please check your email (or python console output) to activate your account.");
        setMode('verify-info');
      }
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('[Auth] Error:', err);
      if (err.response?.status === 403 && err.response?.data?.unverified) {
        setUnverifiedUser(err.response.data.username);
        setMode('resend');
      } else {
        setError(err.response?.data?.error || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setMessage("If a matching account exists, a password reset link has been sent to your email. Check your email inbox (or python console).");
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await requestVerificationEmail(unverifiedUser);
      setMessage("A new verification link has been sent to your email address (check python console).");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to re-send verification email.");
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

        {mode === 'forgot' && (
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', textAlign: 'center' }}>
            🔒 Recover Password
          </h2>
        )}

        {mode === 'resend' && (
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', textAlign: 'center' }}>
            ✉️ Verify Your Account
          </h2>
        )}

        {mode === 'verify-info' && (
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', textAlign: 'center' }}>
            ✅ Registration Successful
          </h2>
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

            {mode === 'login' && (
              <button
                type="button"
                className="auth-link-btn"
                style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'center', marginTop: 4 }}
                onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
              >
                Forgot your password?
              </button>
            )}
          </form>
        )}

        {/* ── Forgot Password Form ─────────────────────── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="auth-form">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, textAlign: 'center', marginBottom: 8 }}>
              Enter the email address associated with your account and we will send you a password reset link.
            </p>
            <div className="form-group">
              <label htmlFor="forgot-email">Email Address</label>
              <input
                type="email"
                id="forgot-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              className="auth-link-btn"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'center', marginTop: 4 }}
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Back to Login
            </button>
          </form>
        )}

        {/* ── Resend Verification Screen ──────────────── */}
        {mode === 'resend' && (
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              It looks like your email address has not been verified yet. Check your spam folders or request a new activation email.
            </p>
            <button type="button" className="auth-submit-btn" onClick={handleResendVerification} disabled={loading}>
              {loading ? 'Sending...' : 'Resend Verification Email'}
            </button>
            <button
              type="button"
              className="auth-link-btn"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'center', marginTop: 8 }}
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Back to Login
            </button>
          </div>
        )}

        {/* ── Activation Sent Info Screen ─────────────── */}
        {mode === 'verify-info' && (
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <button
              type="button"
              className="auth-submit-btn"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Proceed to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
