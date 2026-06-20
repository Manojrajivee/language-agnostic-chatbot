import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';
import InputBar from './InputBar';

const EXAMPLE_PROMPTS = [
  'नमस्ते! आप कैसे हैं?',
  'مرحباً، كيف حالك؟',
  'Bonjour! Comment allez-vous?',
  'こんにちは！お元気ですか？',
  'Привет! Как дела?',
];

/**
 * ChatWindow — the main chat interface with message list, welcome screen, and input.
 */
export default function ChatWindow({ messages, isThinking, onSend, wsStatus }) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Header */}
      <div className="chat-header">
        <div>
          <div className="chat-header-title">LinguaBot</div>
          <div className="chat-header-sub">
            Chat in any language · AI-powered responses
          </div>
        </div>
        <div className="lang-indicator">
          <span className="supported-tag">🌍 80+ Languages</span>
          <span className="supported-tag">↔ RTL / LTR</span>
        </div>
      </div>

      {/* Messages */}
      <div
        className="messages-container"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {isEmpty ? (
          <WelcomeScreen onExampleClick={onSend} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isThinking && <ThinkingIndicator />}
          </>
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Input */}
      <InputBar onSend={onSend} disabled={isThinking || wsStatus === 'connecting'} />
    </>
  );
}

function WelcomeScreen({ onExampleClick }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon" aria-hidden="true">🌐</div>
      <h1 className="welcome-title">Chat in Any Language</h1>
      <p className="welcome-sub">
        Type your message in Hindi, Arabic, French, Japanese, or any of 80+ languages.
        LinguaBot detects your language automatically and responds in kind.
      </p>
      <div className="welcome-examples" aria-label="Example messages">
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            className="example-chip"
            onClick={() => onExampleClick(prompt)}
            title={`Send: ${prompt}`}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
