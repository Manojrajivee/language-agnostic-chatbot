/**
 * ThinkingIndicator — animated typing indicator shown while bot generates response.
 */
export default function ThinkingIndicator() {
  return (
    <div className="thinking-row" role="status" aria-label="Bot is thinking">
      <div className="message-avatar">🤖</div>
      <div className="thinking-bubble">
        <div className="thinking-dot" />
        <div className="thinking-dot" />
        <div className="thinking-dot" />
      </div>
    </div>
  );
}
