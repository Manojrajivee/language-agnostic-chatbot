import { useRef, useState, useEffect } from 'react';
import { uploadFile } from '../services/api';

const PLACEHOLDER_EXAMPLES = [
  'Type in any language...',
  'Écrivez en français...',
  'हिंदी में लिखें...',
  'اكتب بالعربية...',
  '日本語で入力...',
  'Напишите по-русски...',
];

const SUPPORTED_LANGUAGES = [
  { code: '', name: '🌍 Auto-Detect' },
  { code: 'en', name: '🇬🇧 English' },
  { code: 'hi', name: '🇮🇳 Hindi' },
  { code: 'ar', name: '🇸🇦 Arabic' },
  { code: 'es', name: '🇪🇸 Spanish' },
  { code: 'fr', name: '🇫🇷 French' },
  { code: 'ja', name: '🇯🇵 Japanese' },
  { code: 'de', name: '🇩🇪 German' },
  { code: 'zh-cn', name: '🇨🇳 Chinese' },
  { code: 'ru', name: '🇷🇺 Russian' },
  { code: 'pt', name: '🇵🇹 Portuguese' },
];

/**
 * InputBar — message input with voice recognition, manual language override,
 * file uploading/attachments, auto-resizing textarea, and animated placeholder.
 */
export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_EXAMPLES[0]);
  const [selectedLanguage, setSelectedLanguage] = useState(''); // Empty = Auto-detect
  const [isListening, setIsListening] = useState(false);
  
  // File upload state
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const textareaRef = useRef(null);
  const placeholderIdx = useRef(0);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Ref to store latest value to avoid recreating SpeechRecognition on every keystroke
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      placeholderIdx.current = (placeholderIdx.current + 1) % PLACEHOLDER_EXAMPLES.length;
      setPlaceholder(PLACEHOLDER_EXAMPLES[placeholderIdx.current]);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }
  }, [value]);

  // Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;

      const browserLang = navigator.language || 'en-US';
      const localeMap = {
        '': browserLang, 'en': 'en-US', 'hi': 'hi-IN', 'ar': 'ar-SA',
        'es': 'es-ES', 'fr': 'fr-FR', 'ja': 'ja-JP', 'de': 'de-DE',
        'zh-cn': 'zh-CN', 'ru': 'ru-RU', 'pt': 'pt-PT'
      };
      rec.lang = localeMap[selectedLanguage] || browserLang;

      let finalTranscript = '';

      rec.onstart = () => {
        setIsListening(true);
        const currentVal = valueRef.current;
        finalTranscript = currentVal ? currentVal.trim() + ' ' : '';
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        setValue(finalTranscript + interimTranscript);
      };

      rec.onerror = (e) => {
        console.error('[Speech] Error:', e);
        setIsListening(false);
      };
      
      recognitionRef.current = rec;
    }
  }, [selectedLanguage]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed && !attachedFile) return;
    
    // Call parent send handler with text + manual language + attachment file details
    onSend(trimmed, selectedLanguage, attachedFile?.path, attachedFile?.name);
    
    setValue('');
    setAttachedFile(null);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert("Voice speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      const browserLang = navigator.language || 'en-US';
      const localeMap = {
        '': browserLang, 'en': 'en-US', 'hi': 'hi-IN', 'ar': 'ar-SA',
        'es': 'es-ES', 'fr': 'fr-FR', 'ja': 'ja-JP', 'de': 'de-DE',
        'zh-cn': 'zh-CN', 'ru': 'ru-RU', 'pt': 'pt-PT'
      };
      recognitionRef.current.lang = localeMap[selectedLanguage] || browserLang;
      recognitionRef.current.start();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 5MB validation
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds the 5MB limit.");
      return;
    }

    setUploading(true);
    try {
      const { data } = await uploadFile(file);
      setAttachedFile({
        path: data.file_path,
        url: data.file_url,
        name: data.file_name,
        size: data.file_size
      });
    } catch (err) {
      console.error('[Upload] Error:', err);
      alert(err.response?.data?.error || 'Failed to upload file. Support formats: PNG, JPG, JPEG, GIF, PDF, TXT.');
    } finally {
      setUploading(false);
      // Reset input value
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="input-area">
      <div className="input-controls">
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="lang-select"
          disabled={disabled}
          title="Override language detection"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        {selectedLanguage === '' && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8, display: 'flex', alignItems: 'center' }}>
            💡 Tip: Select your language in dropdown for better voice recognition accuracy.
          </span>
        )}
      </div>

      {/* Attached File Preview Card */}
      {(attachedFile || uploading) && (
        <div className="attachment-preview-bar">
          {uploading ? (
            <div className="upload-loading-chip">
              <span className="spinner-dots"></span> Uploading attachment...
            </div>
          ) : (
            <div className="attachment-preview-chip">
              {attachedFile.name.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                <img src={attachedFile.url} alt="Attached thumbnail" className="preview-thumbnail" />
              ) : (
                <span className="preview-icon">📄</span>
              )}
              <span className="preview-filename">{attachedFile.name}</span>
              <button 
                className="remove-attachment-btn" 
                onClick={() => setAttachedFile(null)} 
                aria-label="Remove attachment"
              >
                &times;
              </button>
            </div>
          )}
        </div>
      )}

      <div className="input-wrapper">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".png,.jpg,.jpeg,.gif,.pdf,.txt,.doc,.docx"
        />

        {/* Paperclip Attachment Button */}
        <button
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          title="Attach an image or document (Max 5MB)"
          aria-label="Attach file"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-3.87 3.13-7 7-7s7 3.13 7 7v10.5c0 5.52-4.48 10-10 10S2.5 21.02 2.5 15.5V5H5v10.5c0 4.14 3.36 7.5 7.5 7.5s7.5-3.36 7.5-7.5V5c0-2.76-2.24-5-5-5s-5 2.24-5 5v12.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V6h1.5z" />
          </svg>
        </button>

        {/* Mic Button */}
        <button
          className={`mic-btn ${isListening ? 'listening' : ''}`}
          onClick={toggleListen}
          disabled={disabled}
          title={isListening ? "Listening... click to stop" : "Speak to type"}
          aria-label="Voice input"
        >
          {isListening ? (
            <div className="voice-waves">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : (
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          )}
        </button>

        <textarea
          ref={textareaRef}
          id="chat-input"
          className="chat-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label="Chat input"
          aria-multiline="true"
        />

        <button
          id="send-btn"
          className="send-btn"
          onClick={handleSend}
          disabled={(!value.trim() && !attachedFile) || disabled || uploading}
          aria-label="Send message"
          title="Send message (Enter)"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      <div className="input-footer">
        <span>Press <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>Enter</kbd> to send · <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>Shift+Enter</kbd> for new line</span>
        <span>Supports 80+ languages 🌍</span>
      </div>
    </div>
  );
}
