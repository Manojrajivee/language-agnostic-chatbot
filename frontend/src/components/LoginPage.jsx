import { useState } from 'react';
import { login, signup, requestPasswordReset, requestVerificationEmail } from '../services/api';
import logo from '../assets/logo.png';

/**
 * LoginPage — standalone login/signup page with a premium glassmorphic interface.
 */
export default function LoginPage({ onAuthSuccess, navigateTo }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'resend' | 'verify-info'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState('');

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
      setMessage("If a matching account exists, a password reset link has been sent to your email. Check your email inbox.");
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

        {mode === 'forgot' && (
          <h3 className="auth-heading">🔒 Recover Password</h3>
        )}

        {mode === 'resend' && (
          <h3 className="auth-heading">✉️ Verify Your Account</h3>
        )}

        {mode === 'verify-info' && (
          <h3 className="auth-heading">✅ Registration Successful</h3>
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

            {mode === 'login' && (
              <button
                type="button"
                className="auth-link-btn forgot-link"
                onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
              >
                Forgot your password?
              </button>
            )}
          </form>
        )}

        {/* ── Forgot Password Form ─────────────────────── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="auth-form login-form">
            <p className="auth-helper-text">
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
            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              className="auth-link-btn back-to-login-btn"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Back to Login
            </button>
          </form>
        )}

        {/* ── Resend Verification Screen ──────────────── */}
        {mode === 'resend' && (
          <div className="auth-form login-form" style={{ textAlign: 'center' }}>
            <p className="auth-helper-text">
              It looks like your email address has not been verified yet. Check your spam folders or request a new activation link.
            </p>
            <button type="button" className="login-submit-btn" onClick={handleResendVerification} disabled={loading}>
              {loading ? 'Sending...' : 'Resend Verification Email'}
            </button>
            <button
              type="button"
              className="auth-link-btn back-to-login-btn"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Back to Login
            </button>
          </div>
        )}

        {/* ── Activation Sent Info Screen ─────────────── */}
        {mode === 'verify-info' && (
          <div className="auth-form login-form" style={{ textAlign: 'center' }}>
            <button
              type="button"
              className="login-submit-btn"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            >
              Proceed to Login
            </button>
          </div>
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
