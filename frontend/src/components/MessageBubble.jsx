import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import { 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  RefreshCw, 
  Share2, 
  Volume2, 
  VolumeX, 
  Check, 
  FileText 
} from 'lucide-react';
import { rateMessage } from '../services/api';
import LanguageBadge from './LanguageBadge';

/**
 * Custom CodeBlock with syntax highlighting via highlight.js and copy feature.
 */
function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  const highlightedCode = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(value, { language }).value;
      }
      return hljs.highlightAuto(value).value;
    } catch (e) {
      return value;
    }
  }, [language, value]);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-lang-label">{language || 'code'}</span>
        <button className="copy-code-btn" onClick={handleCopy}>
          {copied ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> Copied!
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Copy size={12} /> Copy code
            </span>
          )}
        </button>
      </div>
      <pre>
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}

/**
 * MessageBubble — renders a single message with Markdown, code highlighting,
 * language badges, multimodal attachments, and feedback reactions.
 */
export default function MessageBubble({ message, onRegenerate }) {
  const { 
    id,
    role, 
    content, 
    detected_language, 
    detected_language_name, 
    direction, 
    attachment, 
    attachment_name, 
    is_liked,
    created_at 
  } = message;

  const isUser = role === 'user';
  const isRtl = direction === 'rtl';
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liked, setLiked] = useState(is_liked);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Sync state if backend props change
  useEffect(() => {
    setLiked(is_liked);
  }, [is_liked]);

  // Stop speaking if component unmounts
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        window.speechSynthesis?.cancel();
      }
    };
  }, [isSpeaking]);

  const formattedTime = created_at
    ? new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const isImageAttachment = () => {
    if (!attachment) return false;
    const lowerName = (attachment_name || attachment).toLowerCase();
    return (
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.gif')
    );
  };

  const handleSpeak = () => {
    if (!window.speechSynthesis) {
      alert("Text-to-Speech is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean up content text for speech (e.g. remove markdown code blocks and tags)
    const cleanText = content.replace(/```[\s\S]*?```/g, '[Code Block]').replace(/[#*`⚠️]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);

    const voiceLocales = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'ar': 'ar-SA',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'ja': 'ja-JP',
      'de': 'de-DE',
      'zh-cn': 'zh-CN',
      'ru': 'ru-RU',
      'pt': 'pt-PT'
    };
    utterance.lang = voiceLocales[detected_language] || detected_language || 'en-US';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleLike = async () => {
    const newStatus = liked === true ? null : true;
    setLiked(newStatus);
    if (id && id !== 'streaming-bot-msg') {
      try {
        await rateMessage(id, newStatus);
      } catch (err) {
        console.warn('Failed to submit like reaction:', err);
      }
    }
  };

  const handleDislike = async () => {
    const newStatus = liked === false ? null : false;
    setLiked(newStatus);
    if (id && id !== 'streaming-bot-msg') {
      try {
        await rateMessage(id, newStatus);
      } catch (err) {
        console.warn('Failed to submit dislike reaction:', err);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`LinguaBot: "${content}"`);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <div className={`message-row ${role}`} aria-label={`${role} message`}>
      <div className="message-avatar" aria-hidden="true">
        {isUser ? '👤' : '🤖'}
      </div>

      <div className="message-content">
        <div
          className="message-bubble"
          dir={isRtl ? 'rtl' : 'ltr'}
          lang={detected_language || 'en'}
        >
          {/* Multimodal Attachment Rendering */}
          {attachment && (
            <div className="bubble-attachment">
              {isImageAttachment() ? (
                <img
                  src={attachment}
                  alt={attachment_name || 'Uploaded image'}
                  className="attachment-preview-img"
                  onClick={() => window.open(attachment, '_blank')}
                  title="Click to view full image"
                />
              ) : (
                <a
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="attachment-preview-doc"
                  title="Click to open document"
                >
                  <span className="doc-icon"><FileText size={18} /></span>
                  <span className="doc-name">{attachment_name || 'Document'}</span>
                </a>
              )}
            </div>
          )}
          
          {content ? (
            <div className="bubble-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <CodeBlock 
                        language={match[1]} 
                        value={String(children).replace(/\n$/, '')} 
                        {...props} 
                      />
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            id === 'streaming-bot-msg' && (
              <div className="bubble-text" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 500 }}>AI is thinking...</span>
                <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                  <span className="thinking-dot-pulse">●</span>
                  <span className="thinking-dot-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                  <span className="thinking-dot-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                </div>
                <style>{`
                  .thinking-dot-pulse {
                    font-size: 8px;
                    animation: pulseDot 1.4s infinite ease-in-out;
                    color: var(--accent-primary);
                    display: inline-block;
                  }
                  @keyframes pulseDot {
                    0%, 100% { opacity: 0.2; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                  }
                `}</style>
              </div>
            )
          )}
        </div>

        {/* Meta & Message actions */}
        <div className="message-meta">
          {formattedTime && (
            <span className="message-time">{formattedTime}</span>
          )}
          
          {detected_language && detected_language !== 'en' && (
            <LanguageBadge
              langCode={detected_language}
              langName={detected_language_name}
              direction={direction}
            />
          )}

          {/* Action buttons (Only for bot replies) */}
          {!isUser && content && id !== 'streaming-bot-msg' && (
            <div className="message-actions-bar">
              {/* Speak */}
              <button
                className={`msg-action-btn ${isSpeaking ? 'active' : ''}`}
                onClick={handleSpeak}
                title={isSpeaking ? "Stop speaking" : "Speak response"}
              >
                {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>

              {/* Copy */}
              <button
                className="msg-action-btn"
                onClick={handleCopy}
                title="Copy response"
              >
                {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
              </button>

              {/* Like */}
              <button
                className={`msg-action-btn ${liked === true ? 'active' : ''}`}
                onClick={handleLike}
                title="Like"
              >
                <ThumbsUp size={14} />
              </button>

              {/* Dislike */}
              <button
                className={`msg-action-btn ${liked === false ? 'active' : ''}`}
                onClick={handleDislike}
                title="Dislike"
              >
                <ThumbsDown size={14} />
              </button>

              {/* Share */}
              <button
                className="msg-action-btn"
                onClick={handleShare}
                title="Share"
              >
                {shared ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Share2 size={14} />}
              </button>

              {/* Regenerate */}
              {onRegenerate && (
                <button
                  className="msg-action-btn"
                  onClick={() => onRegenerate(message)}
                  title="Regenerate response"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
