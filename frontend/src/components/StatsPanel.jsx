import { useState, useEffect, useCallback } from 'react';
import { getLanguageStats } from '../services/api';

/**
 * StatsPanel — displays analytics of detected languages and message distribution.
 */
export default function StatsPanel({ isOpen, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getLanguageStats();
      setStats(response.data);
    } catch (err) {
      console.error('[Stats] Error fetching analytics:', err);
      setError('Failed to load statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen, fetchStats]);

  if (!isOpen) return null;

  return (
    <div className="stats-overlay">
      <div className="stats-modal glass-card">
        <button className="stats-close-btn" onClick={onClose} aria-label="Close stats panel">
          &times;
        </button>

        <div className="stats-header">
          <h2>📊 Language Analytics</h2>
          <button className="stats-refresh-btn" onClick={fetchStats} disabled={loading} title="Refresh statistics">
            <svg
              className={loading ? 'spinning' : ''}
              viewBox="0 0 24 24"
              width="18"
              height="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>

        {error && <div className="stats-error">{error}</div>}

        {loading && !stats ? (
          <div className="stats-loading">
            <div className="loader-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Analyzing conversation database...</p>
          </div>
        ) : stats ? (
          <div className="stats-content">
            <div className="stat-summary-card">
              <span className="stat-num">{stats.total_messages}</span>
              <span className="stat-label">Total Messages Processed</span>
            </div>

            {stats.languages.length === 0 ? (
              <div className="stats-empty">
                <p>No messages in database yet. Start chatting to generate language stats!</p>
              </div>
            ) : (
              <div className="stats-list">
                <h3>Detected Language Breakdown</h3>
                <div className="stats-scroll-area">
                  {stats.languages.map((lang) => {
                    // Give different colors to different languages
                    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];
                    const colorIndex = lang.code.charCodeAt(0) % colors.length;
                    const barColor = colors[colorIndex];

                    return (
                      <div key={lang.code} className="stat-item">
                        <div className="stat-info">
                          <span className="stat-lang-name">{lang.name} ({lang.code})</span>
                          <span className="stat-lang-count">
                            {lang.count} {lang.count === 1 ? 'msg' : 'msgs'} ({lang.percentage}%)
                          </span>
                        </div>
                        <div className="stat-bar-container">
                          <div
                            className="stat-bar-fill"
                            style={{
                              width: `${lang.percentage}%`,
                              backgroundColor: barColor
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
