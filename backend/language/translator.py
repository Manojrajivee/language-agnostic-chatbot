"""
Translation Pipeline
Translates text between user's language and English using deep-translator.
Falls back gracefully on errors.
"""

from deep_translator import GoogleTranslator
from deep_translator.exceptions import RequestError, TranslationNotFound

# Languages that deep-translator / Google Translate use
# Some codes from langdetect differ from Google Translate codes
LANG_CODE_MAP = {
    'zh-cn': 'zh-CN',
    'zh-tw': 'zh-TW',
    'jw': 'jv',    # Javanese
    'ceb': 'ceb',
    'haw': 'haw',
    'hmn': 'hmn',
    'iw': 'he',    # Google sometimes returns 'iw' for Hebrew
}


def _normalize_code(code: str) -> str:
    """Normalize langdetect code to Google Translate compatible code."""
    return LANG_CODE_MAP.get(code, code)


def translate_to_english(text: str, source_lang: str) -> str:
    """
    Translate text from source_lang to English.
    Returns original text if source is already English or translation fails.
    """
    if source_lang == 'en' or not text.strip():
        return text

    try:
        src = _normalize_code(source_lang)
        translator = GoogleTranslator(source=src, target='en')
        result = translator.translate(text)
        return result if result else text
    except (RequestError, TranslationNotFound, Exception):
        # Graceful fallback: return original text
        return text


def translate_from_english(text: str, target_lang: str) -> str:
    """
    Translate English text to target_lang.
    Returns original text if target is English or translation fails.
    """
    if target_lang == 'en' or not text.strip():
        return text

    try:
        tgt = _normalize_code(target_lang)
        translator = GoogleTranslator(source='en', target=tgt)
        result = translator.translate(text)
        return result if result else text
    except (RequestError, TranslationNotFound, Exception):
        # Graceful fallback: return English text
        return text
