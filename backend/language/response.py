"""
Response Generator
Generates bot responses using Google Gemini API.
Falls back to a rule-based response if API key is not configured.
"""

import os
import asyncio


def _get_api_key():
    try:
        from django.conf import settings
        return getattr(settings, 'GEMINI_API_KEY', '')
    except Exception:
        return os.getenv('GEMINI_API_KEY', '')


# Rule-based fallback responses for common intents
FALLBACK_RESPONSES = {
    'greeting': [
        "Hello! How can I help you today?",
        "Hi there! What can I do for you?",
        "Greetings! How may I assist you?",
    ],
    'farewell': [
        "Goodbye! Have a wonderful day!",
        "See you later! Take care!",
        "Bye! Feel free to come back anytime.",
    ],
    'thanks': [
        "You're welcome! Is there anything else I can help with?",
        "Happy to help! Let me know if you need anything else.",
        "My pleasure! Anything else?",
    ],
    'default': [
        "That's an interesting point. Could you tell me more?",
        "I understand. How can I help you further?",
        "Thank you for sharing that. What would you like to know?",
        "I'm here to help! Could you provide more details?",
        "Great question! Let me assist you with that.",
    ],
}

GREETING_KEYWORDS = {'hello', 'hi', 'hey', 'greetings', 'good morning', 'good evening', 'howdy'}
FAREWELL_KEYWORDS = {'bye', 'goodbye', 'see you', 'farewell', 'take care', 'later'}
THANKS_KEYWORDS = {'thank', 'thanks', 'thank you', 'appreciate', 'grateful'}


def _detect_intent(text: str) -> str:
    """Simple rule-based intent detection."""
    lower = text.lower()
    if any(kw in lower for kw in GREETING_KEYWORDS):
        return 'greeting'
    if any(kw in lower for kw in FAREWELL_KEYWORDS):
        return 'farewell'
    if any(kw in lower for kw in THANKS_KEYWORDS):
        return 'thanks'
    return 'default'


def _rule_based_response(text: str) -> str:
    """Generate a rule-based response as fallback."""
    import random
    intent = _detect_intent(text)
    responses = FALLBACK_RESPONSES.get(intent, FALLBACK_RESPONSES['default'])
    return random.choice(responses)


def _gemini_response(text: str, session_id: str, attachment_path: str = '') -> str:
    """Generate a response using Google Gemini API with multimodal attachments support."""
    try:
        import google.generativeai as genai
        api_key = _get_api_key()
        if not api_key:
            raise ValueError("No Gemini API key configured")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')

        system_prompt = (
            "You are a helpful, friendly, and concise multilingual chatbot assistant. "
            "The user's message has been translated to English for you to understand. "
            "Please respond in English with a helpful, natural reply. "
            "Keep responses concise (2-4 sentences max unless detailed explanation is needed). "
            "Be warm and conversational. "
            "If an attachment (image/document) is provided, inspect it and answer the user's questions about it."
        )

        contents = [system_prompt]
        uploaded_file = None

        if attachment_path:
            from django.conf import settings
            abs_path = os.path.join(settings.MEDIA_ROOT, attachment_path)
            
            if os.path.exists(abs_path):
                ext = os.path.splitext(abs_path)[1].lower()
                if ext in ['.png', '.jpg', '.jpeg', '.gif']:
                    from PIL import Image
                    try:
                        img = Image.open(abs_path)
                        contents.append(img)
                    except Exception as e:
                        print(f"[Gemini] Pillow failed to load image: {e}, falling back to file upload")
                        uploaded_file = genai.upload_file(path=abs_path)
                        contents.append(uploaded_file)
                else:
                    # For PDF/text files, upload directly via Gemini File API
                    uploaded_file = genai.upload_file(path=abs_path)
                    contents.append(uploaded_file)

        # Include text prompt if user typed something, or add a default prompt if they only sent an attachment
        if text.strip():
            contents.append(f"User: {text}")
        else:
            contents.append("Please analyze the attached file and provide an overview/reply.")

        response = model.generate_content(contents)
        response_text = response.text.strip()

        # Clean up uploaded file from Gemini server
        if uploaded_file:
            try:
                uploaded_file.delete()
            except Exception as delete_err:
                print(f"[Gemini] Failed to clean up file: {delete_err}")

        return response_text

    except Exception as e:
        # Fall back to rule-based if Gemini fails
        print(f"[Gemini] Error: {e}. Using rule-based fallback.")
        return _rule_based_response(text)


def generate_response_sync(text: str, session_id: str = '', attachment_path: str = '') -> str:
    """Synchronous response generation (used in REST views)."""
    api_key = _get_api_key()
    if api_key:
        return _gemini_response(text, session_id, attachment_path)
    return _rule_based_response(text)


async def generate_response(text: str, session_id: str = '', attachment_path: str = '') -> str:
    """Async response generation (used in WebSocket consumer)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, generate_response_sync, text, session_id, attachment_path)
