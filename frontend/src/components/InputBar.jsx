import { useRef, useState, useEffect } from 'react';
import { Paperclip, Mic, Send, X, AlertCircle } from 'lucide-react';
import { uploadFile } from '../services/api';

const PLACEHOLDER_EXAMPLES = [
  'Ask me anything in any language...',
  'Écrivez en français...',
  'हिंदी में लिखें...',
  'اكتب بالعربية...',
  '日本語で入力...',
  'Напишите по-русски...',
  'Escreva em português...',
];

const SUPPORTED_LANGUAGES = [
  { code: '', name: '🌍 Auto-Detect Language' },
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
 * file uploading/attachments, and auto-resizing.
 */
export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_EXAMPLES[0]);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // File upload state
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const textareaRef = useRef(null);
  const placeholderIdx = useRef(0);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const valueRef = useRef(value);

  // Sync value ref for voice callback closure
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      placeholderIdx.current = (placeholderIdx.current + 1) % PLACEHOLDER_EXAMPLES.length;
      setPlaceholder(PLACEHOLDER_EXAMPLES[placeholderIdx.current]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea heights
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
    
    onSend(trimmed, selectedLanguage, attachedFile?.path, attachedFile?.name);
    
    setValue('');
    setAttachedFile(null);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    // Send message on Enter without shift key, or Ctrl+Enter
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && e.ctrlKey)) {
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
      alert(err.response?.data?.error || 'Failed to upload file. Support formats: PNG, JPG, JPEG, GIF, PDF, TXT, DOCX.');
    } finally {
      setUploading(false);
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
          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={10} /> Tip: Select a language in dropdown for higher voice input accuracy.
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
                <X size={14} />
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

        {/* Paperclip Button */}
        <button
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          title="Attach an image or document (Max 5MB)"
          aria-label="Attach file"
        >
          <Paperclip size={18} />
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
            <Mic size={18} />
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
          title="Send message (Enter / Ctrl+Enter)"
        >
          <Send size={16} />
        </button>
      </div>

      <div className="input-footer">
        <span>Press <kbd style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: 'var(--text-secondary)' }}>Enter</kbd> to send · <kbd style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: 'var(--text-secondary)' }}>Shift+Enter</kbd> for newline</span>
        <span>Supports 80+ languages 🌍</span>
      </div>
    </div>
  );
}
