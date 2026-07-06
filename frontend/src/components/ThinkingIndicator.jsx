/**
 * ThinkingIndicator — animated typing indicator shown while bot generates response.
 */
export default function ThinkingIndicator() {
  return (
    <div className="message-row bot" role="status" aria-label="AI is thinking">
      <div className="message-avatar" aria-hidden="true">🤖</div>
      <div className="message-content">
        <div 
          className="message-bubble" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: 'var(--text-secondary)',
            background: 'var(--bot-bubble)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <span style={{ fontSize: '13.5px', fontWeight: 500 }}>AI is thinking...</span>
          <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
            <span className="thinking-dot-pulse">●</span>
            <span className="thinking-dot-pulse" style={{ animationDelay: '0.2s' }}>●</span>
            <span className="thinking-dot-pulse" style={{ animationDelay: '0.4s' }}>●</span>
          </div>
        </div>
      </div>
      <style>{`
        .thinking-dot-pulse {
          font-size: 8px;
          animation: pulseDot 1.4s infinite ease-in-out;
          color: var(--accent-primary);
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
