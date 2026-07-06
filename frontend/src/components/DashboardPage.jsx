import { useState, useEffect, useCallback } from 'react';
import { getLanguageStats } from '../services/api';
import { 
  ArrowLeft, 
  User, 
  Settings, 
  Download, 
  Sun, 
  Moon, 
  Laptop, 
  LogOut, 
  Globe, 
  MessageSquare, 
  BookOpen
} from 'lucide-react';

/**
 * DashboardPage — dedicated dashboard page combining profile stats, language analytics, and theme settings.
 */
export default function DashboardPage({ 
  username, 
  email, 
  conversations, 
  msgCount, 
  theme, 
  setTheme, 
  currentPersona,
  handleSetPersona,
  currentSessionId,
  handleExport,
  handleLogout,
  navigateTo 
}) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError('');
    try {
      const response = await getLanguageStats();
      setStats(response.data);
    } catch (err) {
      console.error('[Dashboard] Error fetching analytics:', err);
      setStatsError('Failed to load language statistics.');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Find active conversation's details if relevant
  const activeConv = conversations.find(c => c.session_id === currentSessionId);

  return (
    <div className="dashboard-page-container">
      {/* Background Orbs */}
      <div className="bg-glow-orb orb-1"></div>
      <div className="bg-glow-orb orb-3"></div>

      {/* Header */}
      <header className="dashboard-header glass-card">
        <div className="header-left">
          <button className="back-btn-dashboard" onClick={() => navigateTo('chat')} title="Back to Chat">
            <ArrowLeft size={18} />
            <span>Back to Chat</span>
          </button>
        </div>
        <div className="header-title">
          <h2>📊 Account Profile Dashboard</h2>
        </div>
        <div className="header-right">
          <button className="logout-btn-dashboard" onClick={() => { handleLogout(); navigateTo('chat'); }} title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Dashboard Grid */}
      <div className="dashboard-content-grid">
        
        {/* Left Side: Profile details & General stats */}
        <div className="dashboard-col-left">
          
          {/* Profile Card */}
          <div className="dashboard-card glass-card profile-info-card">
            <div className="profile-avatar-large">
              {username ? username.charAt(0).toUpperCase() : 'U'}
            </div>
            <h3 className="profile-name-large">{username || 'Loading User...'}</h3>
            <p className="profile-email-large">{email}</p>
            <span className="profile-badge-tier">Premium Plan member</span>
          </div>

          {/* Quick Stats Grid */}
          <div className="stats-grid-container">
            <div className="dashboard-card glass-card stat-metric-box">
              <span className="metric-icon"><BookOpen size={20} /></span>
              <span className="metric-val">{conversations.length}</span>
              <span className="metric-label">Total Conversations</span>
            </div>
            <div className="dashboard-card glass-card stat-metric-box">
              <span className="metric-icon"><MessageSquare size={20} /></span>
              <span className="metric-val">{msgCount}</span>
              <span className="metric-label">Session Messages</span>
            </div>
          </div>

          {/* Export Chat History */}
          <div className="dashboard-card glass-card export-history-card">
            <h4>💾 Export Conversation Data</h4>
            <p>Download your chat records locally in standard documentation formats.</p>
            <div className="export-btn-group">
              <button onClick={() => handleExport('txt')} className="dashboard-action-btn">
                <Download size={14} /> TXT
              </button>
              <button onClick={() => handleExport('md')} className="dashboard-action-btn">
                <Download size={14} /> Markdown
              </button>
              <button onClick={() => handleExport('pdf')} className="dashboard-action-btn">
                <Download size={14} /> PDF
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Language analytics & settings */}
        <div className="dashboard-col-right">
          
          {/* Language Breakdown Analytics */}
          <div className="dashboard-card glass-card lang-analytics-card">
            <div className="card-header-with-actions">
              <h4><Globe size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Conversation Language Breakdown</h4>
              <button className="refresh-stats-btn" onClick={fetchStats} disabled={loadingStats} title="Refresh Statistics">
                <svg className={loadingStats ? 'spinning' : ''} viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                  <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
              </button>
            </div>

            {statsError && <div className="stats-error">{statsError}</div>}

            {loadingStats && !stats ? (
              <div className="stats-loader-container">
                <div className="loader-dots"><span></span><span></span><span></span></div>
                <p>Generating translation insights...</p>
              </div>
            ) : stats ? (
              <div className="stats-content-inner">
                <div className="stat-summary-badge">
                  Total messages parsed: <strong>{stats.total_messages}</strong>
                </div>

                {stats.languages.length === 0 ? (
                  <div className="stats-empty-dashboard">
                    <p>No logged conversations to analyze yet. Start chatting in multiple languages to check translation analytics!</p>
                  </div>
                ) : (
                  <div className="dashboard-stats-list">
                    {stats.languages.map((lang) => {
                      const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];
                      const colorIndex = lang.code.charCodeAt(0) % colors.length;
                      const barColor = colors[colorIndex];

                      return (
                        <div key={lang.code} className="dashboard-stat-item">
                          <div className="dashboard-stat-meta">
                            <span className="lang-name-tag">{lang.name} ({lang.code})</span>
                            <span className="lang-pct-tag">
                              {lang.count} {lang.count === 1 ? 'msg' : 'msgs'} ({lang.percentage}%)
                            </span>
                          </div>
                          <div className="dashboard-bar-track">
                            <div 
                              className="dashboard-bar-fill" 
                              style={{ 
                                width: `${lang.percentage}%`,
                                backgroundColor: barColor
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* App settings / Customization */}
          <div className="dashboard-card glass-card theme-settings-card">
            <h4><Settings size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Layout & Personalization</h4>
            
            {/* Theme select */}
            <div className="form-group dashboard-form-group">
              <label>Theme Customization</label>
              <div className="theme-toggle-row">
                {[
                  { mode: 'light', icon: <Sun size={14} />, text: 'Light Mode' },
                  { mode: 'dark', icon: <Moon size={14} />, text: 'Dark Mode' },
                  { mode: 'system', icon: <Laptop size={14} />, text: 'System Match' }
                ].map(item => (
                  <button
                    key={item.mode}
                    onClick={() => setTheme(item.mode)}
                    className={`theme-toggle-btn-dashboard ${theme === item.mode ? 'selected' : ''}`}
                  >
                    {item.icon}
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Persona */}
            {activeConv && (
              <div className="form-group dashboard-form-group" style={{ marginTop: 16 }}>
                <label>Default AI Persona (System Override)</label>
                <p className="setting-description-text">Sets the prompt instruction context for your current chat session.</p>
                <select 
                  value={currentPersona}
                  onChange={(e) => handleSetPersona(currentSessionId, e.target.value)}
                  className="dashboard-select"
                >
                  <option value="default">Default Multilingual Helper</option>
                  <option value="programming_expert">Programming Expert</option>
                  <option value="interview_coach">Interview Practice Coach</option>
                  <option value="english_teacher">English Language Teacher</option>
                  <option value="travel_planner">Travel Planner Guide</option>
                  <option value="career_advisor">Career Advisor Consultant</option>
                </select>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
