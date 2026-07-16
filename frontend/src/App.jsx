import { useState, useCallback, useEffect, useRef } from 'react';
import './index.css';
import ChatWindow from './components/ChatWindow';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import StatsPanel from './components/StatsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import logo from './assets/logo.png';
import { 
  getHistory, 
  sendMessage as restSend, 
  getUserConversations, 
  linkGuestConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  duplicateConversation,
  logout
} from './services/api';
import { 
  Settings, 
  User, 
  LogOut, 
  Search, 
  Trash2, 
  Edit2, 
  Pin, 
  Plus, 
  Copy, 
  Download, 
  Folder, 
  Star, 
  Moon, 
  Sun, 
  Laptop,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderOpen
} from 'lucide-react';

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
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('lingua_bot_username') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('lingua_bot_email') || 'user@linguabot.com');

  // Conversations list & active session
  const [conversations, setConversations] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => getGuestSessionId());

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitleVal, setEditTitleVal] = useState('');

  // Modals state
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('lingua_theme') || 'system');

  // Streaming state
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const [currentPersona, setCurrentPersona] = useState('default');

  // Standalone page routing state
  const [currentRoute, setCurrentRoute] = useState(() => {
    const path = window.location.pathname;
    if (path === '/login') return 'login';
    if (path === '/dashboard') return 'dashboard';
    return 'chat';
  });

  const navigateTo = (route) => {
    setCurrentRoute(route);
    const path = route === 'chat' ? '/' : `/${route}`;
    window.history.pushState({}, '', path);
  };

  // Sync state with back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/login') setCurrentRoute('login');
      else if (path === '/dashboard') setCurrentRoute('dashboard');
      else setCurrentRoute('chat');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect to login if user tries to load dashboard unauthorized
  useEffect(() => {
    if (currentRoute === 'dashboard' && !token) {
      navigateTo('login');
    }
  }, [currentRoute, token]);

  // Simple client-side routing logic for verify/reset links
  const [routeInfo, setRouteInfo] = useState(() => {
    const path = window.location.pathname;
    const resetMatch = path.match(/^\/reset-password\/([^/]+)\/([^/]+)\/?$/);
    
    if (resetMatch) {
      return { type: 'reset', uid: resetMatch[1], token: resetMatch[2] };
    }
    return null;
  });

  // Apply CSS theme dynamically based on selection
  useEffect(() => {
    const applyTheme = () => {
      let resolved = theme;
      if (theme === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };
    applyTheme();
    localStorage.setItem('lingua_theme', theme);

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

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

  // Sync active persona Cache on active chat change
  useEffect(() => {
    const activeConv = conversations.find(c => c.session_id === currentSessionId);
    if (activeConv) {
      setCurrentPersona(activeConv.persona || 'default');
    } else {
      setCurrentPersona('default');
    }
  }, [currentSessionId, conversations]);

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleShortcuts = (e) => {
      // Ctrl+N -> New Chat
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      // Ctrl+K -> Search Focus
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('sidebar-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [conversations, token, currentSessionId]);

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
        setMessages((prev) => {
          const updated = [...prev];
          const lastUser = [...updated].reverse().find((m) => m.role === 'user' && !m.detected_language);
          if (lastUser) {
            lastUser.detected_language = data.detected_language;
            lastUser.detected_language_name = data.detected_language_name;
            lastUser.direction = data.direction;
            lastUser.is_override_language = data.is_override_language;
            if (data.attachment) {
              lastUser.attachment = lastUser.attachment =`https://language-agnostic-chatbot-btov.onrender.com${data.attachment}`;
              lastUser.attachment_name = data.attachment_name;
            }
          }
          return [...updated];
        });
        if (data.detected_language) {
          setDetectedLangs((prev) => new Set([...prev, data.detected_language]));
        }
        break;

      case 'bot_chunk_start':
        setIsThinking(false);
        setIsStreamingActive(true);
        setMessages((prev) => [
          ...prev,
          {
            id: 'streaming-bot-msg',
            role: 'bot',
            content: '',
            detected_language: data.detected_language,
            detected_language_name: data.detected_language_name,
            direction: data.direction,
            created_at: new Date().toISOString(),
          }
        ]);
        break;

      case 'bot_chunk':
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'streaming-bot-msg'
              ? { ...m, content: m.content + data.content }
              : m
          )
        );
        break;

      case 'bot_chunk_end':
        setIsStreamingActive(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'streaming-bot-msg'
              ? { ...m, id: data.message_id, content: data.content }
              : m
          )
        );
        setMsgCount((c) => c + 1);
        fetchUserConversations();
        break;

      case 'bot_message':
        setIsThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: data.id || crypto.randomUUID(),
            role: 'bot',
            content: data.content,
            detected_language: data.detected_language,
            detected_language_name: data.detected_language_name,
            direction: data.direction,
            created_at: new Date().toISOString(),
          },
        ]);
        setMsgCount((c) => c + 1);
        fetchUserConversations();
        break;

      case 'conversation_title':
        setConversations((prev) =>
          prev.map((c) =>
            c.session_id === data.session_id ? { ...c, title: data.title } : c
          )
        );
        break;

      case 'error':
        setIsThinking(false);
        setIsStreamingActive(false);
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
  }, [fetchUserConversations]);

  const { status: wsStatus, sendMessage: wsSend, stopGeneration } = useWebSocket(currentSessionId, token, handleWsMessage);

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
     attachment: attachmentPath
  ? `https://language-agnostic-chatbot-btov.onrender.com/media/${attachmentPath}`
  : null,
      attachment_name: attachmentName,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setMsgCount((c) => c + 1);

    // Try WebSocket first, fall back to REST
    const sent = wsSend(text, overrideLanguage, attachmentPath, attachmentName);
    if (!sent) {
      setIsThinking(true);
      try {
        const { data } = await restSend(currentSessionId, text, overrideLanguage, attachmentPath, attachmentName);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMsg.id
              ? { ...m, ...data.user_message }
              : m
          )
        );
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
    setEmail(data.email || `${data.username}@linguabot.com`);
    localStorage.setItem('token', data.token);
    localStorage.setItem('lingua_bot_username', data.username);
    localStorage.setItem('lingua_bot_email', data.email || `${data.username}@linguabot.com`);

    try {
      await linkGuestConversation(currentSessionId);
    } catch (err) {
      console.warn('Failed to link guest conversation:', err);
    }
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
    setEmail('user@linguabot.com');
    localStorage.removeItem('token');
    localStorage.removeItem('lingua_bot_username');
    localStorage.removeItem('lingua_bot_email');
    setConversations([]);
    
    const guestSid = crypto.randomUUID();
    sessionStorage.setItem('chatbot_session', guestSid);
    setCurrentSessionId(guestSid);
  };

  const handleSelectConversation = (session_id) => {
    setCurrentSessionId(session_id);
  };

  // Conversation CRUD Operations handlers
  const handleRenameChat = async (sessionId, newTitle) => {
    if (!newTitle.trim()) return;
    try {
      await updateConversation(sessionId, { title: newTitle });
      setEditingSessionId(null);
      await fetchUserConversations();
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
  };

  const handleDeleteChat = async (sessionId) => {
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await deleteConversation(sessionId);
      await fetchUserConversations();
      if (sessionId === currentSessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleTogglePin = async (sessionId, currentPin) => {
    try {
      await updateConversation(sessionId, { is_pinned: !currentPin });
      await fetchUserConversations();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleToggleSave = async (sessionId, currentSave) => {
    try {
      await updateConversation(sessionId, { is_saved: !currentSave });
      await fetchUserConversations();
    } catch (err) {
      console.error("Failed to toggle save:", err);
    }
  };

  const handleSetCategory = async (sessionId, category) => {
    try {
      await updateConversation(sessionId, { category });
      await fetchUserConversations();
    } catch (err) {
      console.error("Failed to set category:", err);
    }
  };

  const handleSetPersona = async (sessionId, persona) => {
    try {
      await updateConversation(sessionId, { persona });
      setCurrentPersona(persona);
      await fetchUserConversations();
    } catch (err) {
      console.error("Failed to set persona:", err);
    }
  };

  const handleDuplicateChat = async (sessionId) => {
    try {
      const { data } = await duplicateConversation(sessionId);
      setCurrentSessionId(data.session_id);
      await fetchUserConversations();
    } catch (err) {
      console.error("Failed to duplicate conversation:", err);
    }
  };

  const handleStopGeneration = () => {
    stopGeneration();
    setIsStreamingActive(false);
    setIsThinking(false);
  };

  const handleRegenerate = async (botMessage) => {
    const botIdx = messages.findIndex((m) => m.id === botMessage.id);
    if (botIdx === -1) return;
    
    let userMsg = null;
    for (let i = botIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }

    if (!userMsg) return;

    setMessages((prev) => prev.filter((m) => m.id !== botMessage.id));

    // Send original user message back to the pipeline
    handleSend(userMsg.content, userMsg.detected_language, userMsg.attachment?.split('/media/')[1] || '', userMsg.attachment_name);
  };

  // Export functions
  const handleExport = (format) => {
    if (messages.length === 0) return;
    if (format === 'pdf') {
      window.print();
      return;
    }
    let fileContent = '';
    const filename = `chat-export-${currentSessionId.slice(0, 8)}`;
    if (format === 'md') {
      fileContent = messages.map(m => `### ${m.role === 'user' ? 'User' : 'AI'} (${new Date(m.created_at).toLocaleString()})\n\n${m.content}\n`).join('\n---\n\n');
      downloadFile(fileContent, `${filename}.md`, 'text/markdown');
    } else if (format === 'txt') {
      fileContent = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'} (${new Date(m.created_at).toLocaleString()}):\n${m.content}\n`).join('\n\n');
      downloadFile(fileContent, `${filename}.txt`, 'text/plain');
    }
  };

  const downloadFile = (content, fileName, contentType) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Conversations filtering logic
  const filteredConversations = conversations.filter(c => {
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
    const matchesSearch = !searchQuery.trim() || 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.messages && c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesSearch;
  });

  const pinnedConversations = filteredConversations.filter(c => c.is_pinned);
  const unpinnedConversations = filteredConversations.filter(c => !c.is_pinned);

  // Route Rendering for Password Reset confirms
  if (routeInfo) {
    if (routeInfo.type === 'reset') {
      return (
        <PasswordResetConfirmScreen 
          routeInfo={routeInfo} 
          onComplete={() => {
            setRouteInfo(null);
            navigateTo('login');
          }} 
          onCancel={() => {
            setRouteInfo(null);
            navigateTo('chat');
          }} 
        />
      );
    }
  }

  if (currentRoute === 'login') {
    return (
      <LoginPage 
        onAuthSuccess={handleAuthSuccess} 
        navigateTo={navigateTo} 
      />
    );
  }

  if (currentRoute === 'dashboard') {
    return (
      <DashboardPage
        username={username}
        email={email}
        conversations={conversations}
        msgCount={msgCount}
        theme={theme}
        setTheme={setTheme}
        currentPersona={currentPersona}
        handleSetPersona={handleSetPersona}
        currentSessionId={currentSessionId}
        handleExport={handleExport}
        handleLogout={handleLogout}
        navigateTo={navigateTo}
      />
    );
  }

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      
      {/* Sidebar */}
      <aside className="sidebar" role="complementary" aria-label="Chat sidebar">
        
        {/* Logo */}
        <div className="sidebar-logo">
          <img src={logo} alt="LinguaBot Logo" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
          <div>
            <div className="logo-text">LinguaBot</div>
            <div className="logo-sub">Multi-lingual AI Platform</div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="sidebar-actions">
          <button id="new-chat-btn" className="new-chat-btn" onClick={handleNewChat}>
            <Plus size={16} /> New Chat
          </button>
        </div>

        {/* Sidebar Search */}
        <div className="sidebar-search-container">
          <input
            id="sidebar-search"
            type="text"
            className="sidebar-search-input"
            placeholder="Search conversations... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Scrollable middle area */}
        <div className="sidebar-scroll-area">
          
          {/* Categories Grid */}
          <div>
            <div className="sidebar-section-label">Categories</div>
            <div className="sidebar-category-folders">
              {['All', 'Work', 'Study', 'Personal', 'Coding'].map(cat => (
                <button
                  key={cat}
                  className={`category-folder-btn ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Starred / Pinned Chats */}
          {token && pinnedConversations.length > 0 && (
            <div>
              <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={10} fill="currentColor" /> Pinned Chats
              </div>
              <div className="conversation-list">
                {pinnedConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`conversation-item ${conv.session_id === currentSessionId ? 'active' : ''}`}
                  >
                    <div className="conversation-item-top">
                      {editingSessionId === conv.session_id ? (
                        <input
                          type="text"
                          className="rename-input"
                          value={editTitleVal}
                          onChange={(e) => setEditTitleVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameChat(conv.session_id, editTitleVal);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          onBlur={() => handleRenameChat(conv.session_id, editTitleVal)}
                          autoFocus
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', padding: '2px 4px', borderRadius: 4, width: '100%', fontSize: 12 }}
                        />
                      ) : (
                        <span 
                          className="conversation-item-title"
                          onClick={() => handleSelectConversation(conv.session_id)}
                        >
                          {conv.title || 'New Chat'}
                        </span>
                      )}
                      
                      {/* CRUD Buttons */}
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="msg-action-btn" onClick={() => handleTogglePin(conv.session_id, conv.is_pinned)} title="Unpin">
                          <Pin size={11} fill="currentColor" />
                        </button>
                        <button className="msg-action-btn" onClick={() => { setEditingSessionId(conv.session_id); setEditTitleVal(conv.title); }} title="Rename">
                          <Edit2 size={11} />
                        </button>
                        <button className="msg-action-btn" onClick={() => handleDuplicateChat(conv.session_id)} title="Duplicate">
                          <Copy size={11} />
                        </button>
                        <button className="msg-action-btn" onClick={() => handleDeleteChat(conv.session_id)} title="Delete">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <div className="conversation-item-bottom" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="conversation-item-date">{new Date(conv.updated_at).toLocaleDateString()}</span>
                      <span className="category-badge-chip">{conv.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="sidebar-section-label">All Chats</div>
            {token ? (
              unpinnedConversations.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                  No conversations match criteria.
                </div>
              ) : (
                <div className="conversation-list">
                  {unpinnedConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`conversation-item ${conv.session_id === currentSessionId ? 'active' : ''}`}
                    >
                      <div className="conversation-item-top">
                        {editingSessionId === conv.session_id ? (
                          <input
                            type="text"
                            className="rename-input"
                            value={editTitleVal}
                            onChange={(e) => setEditTitleVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameChat(conv.session_id, editTitleVal);
                              if (e.key === 'Escape') setEditingSessionId(null);
                            }}
                            onBlur={() => handleRenameChat(conv.session_id, editTitleVal)}
                            autoFocus
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', padding: '2px 4px', borderRadius: 4, width: '100%', fontSize: 12 }}
                          />
                        ) : (
                          <span 
                            className="conversation-item-title"
                            onClick={() => handleSelectConversation(conv.session_id)}
                          >
                            {conv.title || 'New Chat'}
                          </span>
                        )}
                        
                        {/* CRUD Buttons */}
                        <div className="conversation-crud-row" style={{ display: 'flex', gap: 2 }}>
                          <button className="msg-action-btn" onClick={() => handleTogglePin(conv.session_id, conv.is_pinned)} title="Pin">
                            <Pin size={11} />
                          </button>
                          <button className="msg-action-btn" onClick={() => { setEditingSessionId(conv.session_id); setEditTitleVal(conv.title); }} title="Rename">
                            <Edit2 size={11} />
                          </button>
                          <button className="msg-action-btn" onClick={() => handleDuplicateChat(conv.session_id)} title="Duplicate">
                            <Copy size={11} />
                          </button>
                          <button className="msg-action-btn" onClick={() => handleDeleteChat(conv.session_id)} title="Delete">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      <div className="conversation-item-bottom" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="conversation-item-date">{new Date(conv.updated_at).toLocaleDateString()}</span>
                        <span className="category-badge-chip">{conv.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', lineHeight: 1.4 }}>
                🔒 Sign in to save, sync, and organize your chat history.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {token ? (
            <div className="sidebar-profile-card">
              <div className="sidebar-profile-avatar">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="sidebar-profile-info">
                <span className="sidebar-profile-name">{username}</span>
                <span className="sidebar-profile-status">Premium Plan</span>
              </div>
            </div>
          ) : null}

          <div className="sidebar-footer-menu">
            {token ? (
              <>
                <button className="footer-icon-btn" onClick={() => navigateTo('dashboard')} title="Profile Dashboard">
                  <User size={18} />
                </button>
                <button className="footer-icon-btn" onClick={() => setIsSettingsModalOpen(true)} title="Settings & Options">
                  <Settings size={18} />
                </button>
                <button className="footer-icon-btn" onClick={() => setIsStatsModalOpen(true)} title="Language Stats">
                  📊
                </button>
                <button className="footer-icon-btn" onClick={handleLogout} title="Log Out">
                  <LogOut size={18} style={{ color: 'var(--error)' }} />
                </button>
              </>
            ) : (
              <button className="new-chat-btn" onClick={() => navigateTo('login')} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                🔑 Sign In / Sign Up
              </button>
            )}
          </div>

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

      {/* Main Chat Area */}
      <main className="chat-area" role="main">
        <ChatWindow
          messages={messages}
          isThinking={isThinking}
          onSend={handleSend}
          wsStatus={wsStatus}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isStreamingActive={isStreamingActive}
          onStopGeneration={handleStopGeneration}
          onRegenerate={handleRegenerate}
        />
      </main>

      {/* Modals */}
      <StatsPanel
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>⚙️ Settings & Customization</h2>
              <button className="modal-close-btn" onClick={() => setIsSettingsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Theme Settings */}
              <div className="form-group">
                <label>Theme Mode</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { mode: 'light', icon: <Sun size={14} />, text: 'Light' },
                    { mode: 'dark', icon: <Moon size={14} />, text: 'Dark' },
                    { mode: 'system', icon: <Laptop size={14} />, text: 'Auto' }
                  ].map(item => (
                    <button
                      key={item.mode}
                      onClick={() => setTheme(item.mode)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: theme === item.mode ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: theme === item.mode ? '#fff' : 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {item.icon} {item.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona settings */}
              <div className="form-group">
                <label>AI Persona (System Prompt Override)</label>
                <select 
                  value={currentPersona}
                  onChange={(e) => handleSetPersona(currentSessionId, e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="default">Default Multilingual Helper</option>
                  <option value="programming_expert">Programming Expert</option>
                  <option value="interview_coach">Interview Practice Coach</option>
                  <option value="english_teacher">English Language Teacher</option>
                  <option value="travel_planner">Travel Planner Guide</option>
                  <option value="career_advisor">Career Advisor Consultant</option>
                </select>
              </div>

              {/* Chat Folder Category selection */}
              <div className="form-group">
                <label>Folder Category</label>
                <select 
                  value={conversations.find(c => c.session_id === currentSessionId)?.category || 'Personal'}
                  onChange={(e) => handleSetCategory(currentSessionId, e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="Personal">📁 Personal</option>
                  <option value="Work">💼 Work</option>
                  <option value="Study">📚 Study</option>
                  <option value="Coding">💻 Coding</option>
                </select>
              </div>

              {/* Export Panel */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginTop: 16 }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Export Chat History</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleExport('txt')} className="example-chip" style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Download size={13} /> TXT
                  </button>
                  <button onClick={() => handleExport('md')} className="example-chip" style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Download size={13} /> Markdown
                  </button>
                  <button onClick={() => handleExport('pdf')} className="example-chip" style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Download size={13} /> PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Link Routing Screen Subcomponents ────────────────────────


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
      <div className="glass-card auth-modal" style={{ padding: '30px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16 }}>
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
              <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading} style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: 8, padding: 12, border: 'none', width: '100%', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? 'Updating password...' : 'Update Password'}
            </button>
            <button 
              type="button" 
              className="auth-link-btn" 
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', marginTop: '10px', display: 'block', width: '100%', textAlign: 'center' }} 
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
