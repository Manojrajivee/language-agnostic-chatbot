import { useState, useEffect } from 'react';
import LanguageBadge from './LanguageBadge';

/**
 * MessageBubble — renders a single message with language badge, RTL/LTR direction,
 * multimodal attachment (image/document), and Text-to-Speech (TTS) speaker button for bot responses.
 */
export default function MessageBubble({ message }) {
  const { 
    role, 
    content, 
    detected_language, 
    detected_language_name, 
    direction, 
    attachment, 
    attachment_name, 
    created_at 
  } = message;

  const isUser = role === 'user';
  const isRtl = direction === 'rtl';
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  // Determine if attachment is an image
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

    // Cancel anything currently playing
    window.speechSynthesis.cancel();

    // Clean up content text for speech (e.g., remove code blocks or markdown emojis if needed)
    const cleanText = content.replace(/[#*`⚠️]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Map language code to standard SpeechSynthesis locale
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

  return (
    <div className={`message-row ${role}`} aria-label={`${role} message`}>
      {/* Avatar */}
      <div className="message-avatar" aria-hidden="true">
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
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
                  <span className="doc-icon">📄</span>
                  <span className="doc-name">{attachment_name || 'Document'}</span>
                </a>
              )}
            </div>
          )}
          
          {content && <div className="bubble-text">{content}</div>}
        </div>

        {/* Meta: time + language badge + TTS speaker */}
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

          {/* Text-to-Speech Button (Only for bot responses or if text exists) */}
          {!isUser && content && (
            <button
              className={`speaker-btn ${isSpeaking ? 'speaking' : ''}`}
              onClick={handleSpeak}
              title={isSpeaking ? "Stop speaking" : "Speak response"}
              aria-label="Speak response"
            >
              {isSpeaking ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
