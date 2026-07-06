import { useEffect, useRef, useState } from 'react';
import { Menu, ArrowDown, Square, Globe } from 'lucide-react';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';
import InputBar from './InputBar';

const EXAMPLE_PROMPTS = [
  '👋 Write a travel guide for 3 days in Paris',
  '💻 Code a responsive card grid in CSS grid',
  '📝 Help me draft a professional resume summary',
  '🏫 Explain quantum computing to a 10 year old',
];

/**
 * ChatWindow — the main chat interface with message list, welcome screen, auto-scroll,
 * and input bar integration.
 */
export default function ChatWindow({ 
  messages, 
  isThinking, 
  onSend, 
  wsStatus,
  isSidebarOpen,
  onToggleSidebar,
  isStreamingActive,
  onStopGeneration,
  onRegenerate
}) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll to bottom on new messages or thinking status change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Handle scroll detection to show/hide the floating scroll-to-bottom arrow
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Show arrow if user scrolled up by more than 150px
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <button 
            className="sidebar-toggle-btn" 
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <Menu size={20} />
          </button>
          <div>
            <div className="chat-header-title">LinguaBot</div>
            <div className="chat-header-sub">
              Agnostic Multi-lingual Chat Platform
            </div>
          </div>
        </div>
        <div className="lang-indicator">
          <span className="supported-tag">🌍 80+ Languages</span>
          <span className="supported-tag">↔ RTL / LTR</span>
        </div>
      </div>

      {/* Messages Scroll Container */}
      <div
        className="messages-container"
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {isEmpty ? (
          <WelcomeScreen onExampleClick={onSend} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                onRegenerate={msg.role === 'bot' && messages[messages.length - 1]?.id === msg.id ? onRegenerate : null}
              />
            ))}
            {isThinking && <ThinkingIndicator />}
          </>
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Floating Stop Generating Button */}
      {isStreamingActive && (
        <div className="stop-generation-container">
          <button className="stop-gen-btn" onClick={onStopGeneration} aria-label="Stop generation">
            <Square size={10} fill="currentColor" /> Stop Generating
          </button>
        </div>
      )}

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button 
          className="scroll-bottom-btn" 
          onClick={scrollToBottom}
          title="Scroll to latest message"
          aria-label="Scroll to latest message"
        >
          <ArrowDown size={16} />
        </button>
      )}

      {/* Input */}
      <InputBar onSend={onSend} disabled={isThinking || wsStatus === 'connecting'} />
    </>
  );
}

function WelcomeScreen({ onExampleClick }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon" aria-hidden="true">
        <Globe size={48} className="logo-icon" style={{ padding: 0, background: 'none' }} />
      </div>
      <h1 className="welcome-title">How can I help you today?</h1>
      <p className="welcome-sub">
        Ask anything. LinguaBot automatically detects your language, translates it, 
        and generates responses in your speech style—supporting 80+ languages and RTL directions.
      </p>
      <div className="welcome-examples" aria-label="Example prompts">
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            className="example-chip"
            onClick={() => onExampleClick(prompt.substring(2))} // Remove the emoji from prompt text
            title={`Send prompt: ${prompt}`}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
