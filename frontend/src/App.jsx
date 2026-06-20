import { useState, useCallback, useEffect } from 'react';
import './index.css';
import ChatWindow from './components/ChatWindow';
import AuthModal from './components/AuthModal';
import StatsPanel from './components/StatsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { 
  getHistory, 
  sendMessage as restSend, 
  getUserConversations, 
  linkGuestConversation,
  createConversation,
  logout
} from './services/api';

// Generate or retrieve session ID for anonymous users
function getGuestSessionId() {
  let sid = sessionStorage.getItem('chatbot_session');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('chatbot_session', sid);
  }
  return sid;
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [detectedLangs, setDetectedLangs] = useState(new Set());
  const [msgCount, setMsgCount] = useState(0);

  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem('lingua_bot_token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('lingua_bot_username') || '');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Conversations list & active session
  const [conversations, setConversations] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => getGuestSessionId());

  // Stats modal state
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  // Simple client-side routing logic for verify/reset links
  const [routeInfo, setRouteInfo] = useState(() => {
    const path = window.location.pathname;
    const verifyMatch = path.match(/^\/verify-email\/([^/]+)\/([^/]+)\/?$/);
    const resetMatch = path.match(/^\/reset-password\/([^/]+)\/([^/]+)\/?$/);
    
    if (verifyMatch) {
      return { type: 'verify', uid: verifyMatch[1], token: verifyMatch[2] };
    }
    if (resetMatch) {
      return { type: 'reset', uid: resetMatch[1], token: resetMatch[2] };
    }
    return null;
  });

  // Load user's conversations list if authenticated
  const fetchUserConversations = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await getUserConversations();
      setConversations(data);
    } catch (err) {
      console.error('[History] Failed to load conversations list:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchUserConversations();
  }, [fetchUserConversations]);

  // Load chat history when active session ID changes
  useEffect(() => {
    getHistory(currentSessionId)
      .then(({ data }) => {
        if (data.messages) {
          setMessages(data.messages);
          const langs = new Set(data.messages.map((m) => m.detected_language).filter(Boolean));
          setDetectedLangs(langs);
          setMsgCount(data.messages.length);
        } else {
          setMessages([]);
          setDetectedLangs(new Set());
          setMsgCount(0);
        }
      })
      .catch((err) => {
        console.error('[History] Failed to load session messages:', err);
        setMessages([]);
        setDetectedLangs(new Set());
        setMsgCount(0);
      });
  }, [currentSessionId]);

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected':
        console.log('[WS] Connected session:', data.session_id);
        break;

      case 'thinking':
        setIsThinking(true);
        break;

      case 'user_message':
        // Update user message language metadata (since it was appended optimistically)
        setMessages((prev) => {
          const updated = [...prev];
          const lastUser = [...updated].reverse().find((m) => m.role === 'user' && !m.detected_language);
          if (lastUser) {
            lastUser.detected_language = data.detected_language;
            lastUser.detected_language_name = data.detected_language_name;
            lastUser.direction = data.direction;
            lastUser.is_override_language = data.is_override_language;
            if (data.attachment) {
              lastUser.attachment = `http://localhost:8000${data.attachment}`;
              lastUser.attachment_name = data.attachment_name;
            }
          }
          return [...updated];
        });
        if (data.detected_language) {
          setDetectedLangs((prev) => new Set([...prev, data.detected_language]));
        }
        break;

      case 'bot_message':
        setIsThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'bot',
            content: data.content,
            detected_language: data.detected_language,
            detected_language_name: data.detected_language_name,
            direction: data.direction,
            created_at: new Date().toISOString(),
          },
        ]);
        setMsgCount((c) => c + 1);
        break;

      case 'error':
        setIsThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'bot',
            content: `⚠️ ${data.message}`,
            detected_language: 'en',
            detected_language_name: 'English',
            direction: 'ltr',
            created_at: new Date().toISOString(),
          },
        ]);
        break;

      default:
        break;
    }
  }, []);

  const { status: wsStatus, sendMessage: wsSend } = useWebSocket(currentSessionId, token, handleWsMessage);

  const handleSend = useCallback(async (text, overrideLanguage = '', attachmentPath = '', attachmentName = '') => {
    if (!text.trim() && !attachmentPath) return;

    // Optimistic UI: show user message immediately
    const optimisticMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      detected_language: overrideLanguage || null,
      detected_language_name: overrideLanguage ? 'Manual Override' : null,
      direction: 'ltr',
      is_override_language: !!overrideLanguage,
      attachment: attachmentPath ? `http://localhost:8000/media/${attachmentPath}` : null,
      attachment_name: attachmentName,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setMsgCount((c) => c + 1);

    // Try WebSocket first, fall back to REST
    const sent = wsSend(text, overrideLanguage, attachmentPath, attachmentName);
    if (!sent) {
      // REST fallback
      setIsThinking(true);
      try {
        const { data } = await restSend(currentSessionId, text, overrideLanguage, attachmentPath, attachmentName);
        // Update user message language info
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMsg.id
              ? { ...m, ...data.user_message }
              : m
          )
        );
        // Add bot response
        setMessages((prev) => [
          ...prev,
          {
            id: data.bot_message.id || crypto.randomUUID(),
            role: 'bot',
            content: data.bot_message.content,
            detected_language: data.bot_message.detected_language,
            detected_language_name: data.bot_message.detected_language_name,
            direction: data.bot_message.direction,
            created_at: new Date().toISOString(),
          },
        ]);
        if (data.user_message?.detected_language) {
          setDetectedLangs((prev) => new Set([...prev, data.user_message.detected_language]));
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'bot',
            content: '⚠️ Unable to connect to the server. Please ensure the backend is running.',
            detected_language: 'en',
            detected_language_name: 'English',
            direction: 'ltr',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    }
  }, [currentSessionId, wsSend]);

  const handleNewChat = async () => {
    const newSessionId = crypto.randomUUID();
    if (token) {
      try {
        await createConversation(newSessionId);
        await fetchUserConversations();
      } catch (err) {
        console.error('Failed to create new conversation:', err);
      }
    } else {
      sessionStorage.setItem('chatbot_session', newSessionId);
    }
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setMsgCount(0);
    setDetectedLangs(new Set());
  };

  const handleAuthSuccess = async (data) => {
    setToken(data.token);
    setUsername(data.username);
    localStorage.setItem('lingua_bot_token', data.token);
    localStorage.setItem('lingua_bot_username', data.username);

    // Link current guest session to the logged-in user
    try {
      await linkGuestConversation(currentSessionId);
    } catch (err) {
      console.warn('Failed to link guest conversation:', err);
    }
    
    // Refresh conversations list
    await fetchUserConversations();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout request failed, clearing local tokens anyway.');
    }
    setToken('');
    setUsername('');
    localStorage.removeItem('lingua_bot_token');
    localStorage.removeItem('lingua_bot_username');
    setConversations([]);
    
    // Restart as a guest session
    const guestSid = crypto.randomUUID();
    sessionStorage.setItem('chatbot_session', guestSid);
    setCurrentSessionId(guestSid);
  };

  const handleSelectConversation = (session_id) => {
    setCurrentSessionId(session_id);
  };

  // Route Rendering for Email Verification and Password Reset confirms
  if (routeInfo) {
    if (routeInfo.type === 'verify') {
      return (
        <EmailVerificationScreen 
          routeInfo={routeInfo} 
          onComplete={(authData) => {
            if (authData) handleAuthSuccess(authData);
            setRouteInfo(null);
            window.history.replaceState({}, '', '/');
          }} 
          onCancel={() => {
            setRouteInfo(null);
            window.history.replaceState({}, '', '/');
          }} 
        />
      );
    }
    if (routeInfo.type === 'reset') {
      return (
        <PasswordResetConfirmScreen 
          routeInfo={routeInfo} 
          onComplete={() => {
            setRouteInfo(null);
            window.history.replaceState({}, '', '/');
            setIsAuthModalOpen(true); // Open login modal
          }} 
          onCancel={() => {
            setRouteInfo(null);
            window.history.replaceState({}, '', '/');
          }} 
        />
      );
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar" role="complementary" aria-label="Chat sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon" aria-hidden="true">🌐</div>
          <div>
            <div className="logo-text">LinguaBot</div>
            <div className="logo-sub">Multilingual AI Assistant</div>
          </div>
        </div>

        {/* New Chat */}
        <button id="new-chat-btn" className="new-chat-btn" onClick={handleNewChat}>
          <span>✏️</span> New Conversation
        </button>

        {/* Analytics Button */}
        <button className="stats-trigger-btn" onClick={() => setIsStatsModalOpen(true)}>
          📊 View Stats Dashboard
        </button>

        {/* Session Stats */}
        <div>
          <div className="sidebar-section-label">Session Info</div>
          <div className="lang-stats">
            <div className="lang-stat-item">
              <span className="lang-stat-label">Messages</span>
              <span className="lang-stat-value">{msgCount}</span>
            </div>
            <div className="lang-stat-item">
              <span className="lang-stat-label">Languages</span>
              <span className="lang-stat-value">{detectedLangs.size || '—'}</span>
            </div>
            <div className="lang-stat-item">
              <span className="lang-stat-label">Active ID</span>
              <span className="lang-stat-value" style={{ fontSize: 11 }}>
                {currentSessionId.slice(0, 8)}…
              </span>
            </div>
          </div>
        </div>

        {/* User Conversation History List */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="sidebar-section-label">My History</div>
          {token ? (
            conversations.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                No past conversations.
              </div>
            ) : (
              <div className="conversation-list">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    className={`conversation-item ${conv.session_id === currentSessionId ? 'active' : ''}`}
                    onClick={() => handleSelectConversation(conv.session_id)}
                  >
                    <div className="conversation-item-title">
                      Chat {conv.session_id.slice(0, 8)}...
                    </div>
                    <div className="conversation-item-date">
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', lineHeight: 1.4 }}>
              🔒 Sign in to save and sync your chat history.
            </div>
          )}
        </div>

        {/* Profile / Auth section */}
        {token ? (
          <div className="profile-section">
            <div className="profile-user-info">
              <span className="avatar-icon">👤</span>
              <span>{username}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        ) : (
          <button className="login-trigger-btn" onClick={() => setIsAuthModalOpen(true)}>
            🔑 Log In / Sign Up
          </button>
        )}

        {/* Connection Status */}
        <div className="sidebar-bottom">
          <div className="connection-status">
            <div className={`status-dot ${wsStatus}`} />
            <span>
              {wsStatus === 'connected' && 'WebSocket Connected'}
              {wsStatus === 'connecting' && 'Connecting…'}
              {wsStatus === 'disconnected' && 'Using REST API'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Chat */}
      <main className="chat-area" role="main">
        <ChatWindow
          messages={messages}
          isThinking={isThinking}
          onSend={handleSend}
          wsStatus={wsStatus}
        />
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <StatsPanel
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />
    </div>
  );
}

// ── Link Routing Screen Subcomponents ────────────────────────

function EmailVerificationScreen({ routeInfo, onComplete, onCancel }) {
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    import('./services/api').then(({ confirmEmailVerification }) => {
      confirmEmailVerification(routeInfo.uid, routeInfo.token)
        .then(({ data }) => {
          setStatus('success');
          setTimeout(() => {
            onComplete(data);
          }, 2000);
        })
        .catch((err) => {
          setStatus('error');
          setError(err.response?.data?.error || 'Verification link invalid or expired.');
        });
    });
  }, [routeInfo, onComplete]);

  return (
    <div className="auth-overlay">
      <div className="glass-card auth-modal" style={{ textAlign: 'center', padding: '40px' }}>
        {status === 'verifying' && (
          <div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>✉️ Verifying Account</h2>
            <div className="loader-dots"><span></span><span></span><span></span></div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>Activating your account credentials. Please wait...</p>
          </div>
        )}
        {status === 'success' && (
          <div>
            <h2 style={{ color: 'var(--success)', marginBottom: '16px' }}>✅ Activation Success!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Your account is verified and ready. Redirecting to chat...</p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <h2 style={{ color: 'var(--error)', marginBottom: '16px' }}>❌ Verification Failed</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
            <button className="auth-submit-btn" onClick={onCancel}>Back to Main Screen</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordResetConfirmScreen({ routeInfo, onComplete, onCancel }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError('');
    setLoading(true);

    try {
      const { confirmPasswordReset } = await import('./services/api');
      await confirmPasswordReset(routeInfo.uid, routeInfo.token, password);
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Password reset link invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="glass-card auth-modal" style={{ padding: '30px' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px', textAlign: 'center' }}>🔒 Reset Password</h2>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--success)', marginBottom: '10px' }}>✅ Password reset successful!</p>
            <p style={{ color: 'var(--text-secondary)' }}>Redirecting to Login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Updating password...' : 'Update Password'}
            </button>
            <button 
              type="button" 
              className="auth-link-btn" 
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', marginTop: '10px' }} 
              onClick={onCancel}
            >
              Cancel and Return
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
