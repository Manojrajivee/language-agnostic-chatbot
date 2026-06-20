/**
 * LanguageBadge — displays detected language with RTL/LTR direction indicator.
 */
export default function LanguageBadge({ langCode, langName, direction }) {
  if (!langCode || langCode === 'unknown') return null;

  const isRtl = direction === 'rtl';
  const flag = getFlag(langCode);

  return (
    <span
      className={`lang-badge ${direction}`}
      title={`Detected: ${langName} (${isRtl ? 'Right-to-Left' : 'Left-to-Right'})`}
      aria-label={`Language: ${langName}`}
    >
      {flag && <span>{flag}</span>}
      {langName}
      {isRtl && <span style={{ opacity: 0.8 }}>⟵</span>}
    </span>
  );
}

/**
 * Returns a flag emoji for common language codes.
 */
function getFlag(code) {
  const flags = {
    en: '🇬🇧', hi: '🇮🇳', ar: '🇸🇦', fr: '🇫🇷', de: '🇩🇪',
    es: '🇪🇸', zh: '🇨🇳', 'zh-cn': '🇨🇳', ja: '🇯🇵', ko: '🇰🇷',
    ru: '🇷🇺', pt: '🇧🇷', it: '🇮🇹', ur: '🇵🇰', fa: '🇮🇷',
    he: '🇮🇱', tr: '🇹🇷', vi: '🇻🇳', th: '🇹🇭', nl: '🇳🇱',
    pl: '🇵🇱', uk: '🇺🇦', sv: '🇸🇪', no: '🇳🇴', da: '🇩🇰',
    fi: '🇫🇮', cs: '🇨🇿', ro: '🇷🇴', hu: '🇭🇺', el: '🇬🇷',
    bn: '🇧🇩', ta: '🇮🇳', te: '🇮🇳', ml: '🇮🇳', kn: '🇮🇳',
    mr: '🇮🇳', gu: '🇮🇳', pa: '🇮🇳', sw: '🇰🇪', id: '🇮🇩',
    ms: '🇲🇾', tl: '🇵🇭',
  };
  return flags[code] || '🌐';
}
