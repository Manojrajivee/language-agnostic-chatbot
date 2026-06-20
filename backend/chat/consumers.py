import json
import os
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from .models import Conversation, Message
from language.detector import detect_language, LANGUAGE_NAMES, RTL_LANGUAGES
from language.translator import translate_to_english, translate_from_english
from language.response import generate_response


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer handling real-time chat with language support, authentication, and attachments."""

    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'chat_{self.session_id}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Ensure conversation exists and link user if authenticated
        await self.get_or_create_conversation()

        user = self.scope.get('user')
        username = user.username if user and user.is_authenticated else None

        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'Connected to Language Agnostic Chatbot',
            'session_id': self.session_id,
            'username': username,
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming user message and attachments."""
        try:
            data = json.loads(text_data)
            user_message = data.get('message', '').strip()
            override_lang = data.get('override_language', '').strip()
            attachment_path = data.get('attachment_path', '').strip()
            attachment_name = data.get('attachment_name', '').strip()

            if not user_message and not attachment_path:
                return

            # Determine language details
            is_override = False
            if override_lang and override_lang in LANGUAGE_NAMES:
                lang_code = override_lang
                lang_name = LANGUAGE_NAMES[override_lang]
                lang_dir = 'rtl' if override_lang in RTL_LANGUAGES else 'ltr'
                lang_info = {'code': lang_code, 'name': lang_name, 'direction': lang_dir}
                is_override = True
            else:
                lang_info = detect_language(user_message) if user_message else {'code': 'en', 'name': 'English', 'direction': 'ltr'}

            # 2. Save user message to DB
            await self.save_message(
                role='user',
                content=user_message,
                detected_language=lang_info['code'],
                detected_language_name=lang_info['name'],
                direction=lang_info['direction'],
                is_override=is_override,
                attachment_path=attachment_path,
                attachment_name=attachment_name
            )

            # Build absolute URL for echo response if attachment exists
            attachment_url = None
            if attachment_path:
                # We can construct the media url (in development: settings.MEDIA_URL)
                # Since we don't have request here to run request.build_absolute_uri,
                # we can use a relative or host-constructed URL.
                # Usually client can prepend host, or we can just send media URL.
                attachment_url = settings.MEDIA_URL + attachment_path

            # 3. Send user message back with language info (echo)
            await self.send(text_data=json.dumps({
                'type': 'user_message',
                'content': user_message,
                'detected_language': lang_info['code'],
                'detected_language_name': lang_info['name'],
                'direction': lang_info['direction'],
                'is_override_language': is_override,
                'attachment': attachment_url,
                'attachment_name': attachment_name,
            }))

            # 4. Signal typing indicator
            await self.send(text_data=json.dumps({'type': 'thinking'}))

            # 5. Translate to English for NLP if message text is present
            english_text = translate_to_english(user_message, lang_info['code']) if user_message else ''

            # 6. Generate response in English (passing attachment_path if present)
            english_response = await generate_response(english_text, self.session_id, attachment_path)

            # 7. Translate response back to user's language
            if lang_info['code'] != 'en' and english_response:
                final_response = translate_from_english(english_response, lang_info['code'])
            else:
                final_response = english_response

            # 8. Save bot response
            await self.save_message(
                role='bot',
                content=final_response,
                detected_language=lang_info['code'],
                detected_language_name=lang_info['name'],
                direction=lang_info['direction'],
                translated_content=english_response,
            )

            # 9. Send bot response to client
            await self.send(text_data=json.dumps({
                'type': 'bot_message',
                'content': final_response,
                'detected_language': lang_info['code'],
                'detected_language_name': lang_info['name'],
                'direction': lang_info['direction'],
            }))

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Error processing message: {str(e)}',
            }))

    @database_sync_to_async
    def get_or_create_conversation(self):
        user = self.scope.get('user')
        conversation, created = Conversation.objects.get_or_create(session_id=self.session_id)
        if user and user.is_authenticated and conversation.user is None:
            conversation.user = user
            conversation.save()
        self.conversation = conversation
        return conversation

    @database_sync_to_async
    def save_message(self, role, content, detected_language, detected_language_name,
                     direction, translated_content='', is_override=False,
                     attachment_path='', attachment_name=''):
        user = self.scope.get('user')
        conversation, _ = Conversation.objects.get_or_create(session_id=self.session_id)
        if user and user.is_authenticated and conversation.user is None:
            conversation.user = user
            conversation.save()
            
        return Message.objects.create(
            conversation=conversation,
            role=role,
            content=content,
            detected_language=detected_language,
            detected_language_name=detected_language_name,
            direction=direction,
            translated_content=translated_content,
            is_override_language=is_override,
            attachment=attachment_path or None,
            attachment_name=attachment_name,
        )
