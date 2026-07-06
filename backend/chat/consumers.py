import json
import os
import uuid
import re
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from .models import Conversation, Message
from language.detector import detect_language, LANGUAGE_NAMES, RTL_LANGUAGES
from language.translator import translate_to_english, translate_from_english
from language.response import generate_response_stream


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer handling real-time chat with streaming, personas, language support, and title generation."""

    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'chat_{self.session_id}'
        self.generation_active = False

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

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
        if hasattr(self, 'generation_task') and not self.generation_task.done():
            self.generation_task.cancel()
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming user message or actions like stop_generation sequentially."""
        try:
            data = json.loads(text_data)
            action_type = data.get('type')

            if action_type == 'stop_generation':
                if hasattr(self, 'generation_task') and not self.generation_task.done():
                    self.generation_task.cancel()
                return

            user_message = data.get('message', '').strip()
            override_lang = data.get('override_language', '').strip()
            attachment_path = data.get('attachment_path', '').strip()
            attachment_name = data.get('attachment_name', '').strip()

            if not user_message and not attachment_path:
                return

            # Cancel any previously running generation task before starting a new one
            if hasattr(self, 'generation_task') and not self.generation_task.done():
                self.generation_task.cancel()

            # Start the generation and streaming as a background task
            self.generation_task = asyncio.create_task(
                self.generate_and_stream(user_message, override_lang, attachment_path, attachment_name)
            )

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Error processing message: {str(e)}',
            }))

    async def generate_and_stream(self, user_message, override_lang, attachment_path, attachment_name):
        bot_message_id = str(uuid.uuid4())
        
        # Local variables to collect data for saving in finally block
        lang_info = {'code': 'en', 'name': 'English', 'direction': 'ltr'}
        english_text = ""
        accumulated_english = ""
        accumulated_translation = ""
        untranslated_buffer = ""
        conversation = None

        try:
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
                attachment_url = settings.MEDIA_URL + attachment_path

            # 3. Echo user message back
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

            # 4. Signal thinking animation
            await self.send(text_data=json.dumps({'type': 'thinking'}))

            # 5. Translate to English for NLP if text is present
            english_text = translate_to_english(user_message, lang_info['code']) if user_message else ''

            # 6. Fetch conversation details to check persona
            conversation = await self.get_or_create_conversation()
            persona = getattr(conversation, 'persona', 'default')

            # 7. Start streaming response
            self.generation_active = True
            
            queue = asyncio.Queue()
            loop = asyncio.get_running_loop()

            def run_generator_sync():
                try:
                    for chunk in generate_response_stream(english_text, self.session_id, attachment_path, persona):
                        loop.call_soon_threadsafe(queue.put_nowait, ('chunk', chunk))
                except Exception as ex:
                    loop.call_soon_threadsafe(queue.put_nowait, ('error', ex))
                finally:
                    loop.call_soon_threadsafe(queue.put_nowait, ('done', None))

            loop.run_in_executor(None, run_generator_sync)

            await self.send(text_data=json.dumps({
                'type': 'bot_chunk_start',
                'message_id': bot_message_id,
                'detected_language': lang_info['code'],
                'detected_language_name': lang_info['name'],
                'direction': lang_info['direction'],
            }))

            while self.generation_active:
                item_type, val = await queue.get()
                if item_type == 'error':
                    raise val
                elif item_type == 'done':
                    break
                elif item_type == 'chunk':
                    accumulated_english += val
                    
                    if lang_info['code'] == 'en':
                        accumulated_translation += val
                        await self.send(text_data=json.dumps({
                            'type': 'bot_chunk',
                            'message_id': bot_message_id,
                            'content': val,
                        }))
                    else:
                        untranslated_buffer += val
                        sentences = re.split(r'(?<=[.!?])\s+', untranslated_buffer)
                        if len(sentences) > 1:
                            for complete_sentence in sentences[:-1]:
                                if complete_sentence.strip():
                                    translated = translate_from_english(complete_sentence, lang_info['code'])
                                    accumulated_translation += translated + " "
                                    await self.send(text_data=json.dumps({
                                        'type': 'bot_chunk',
                                        'message_id': bot_message_id,
                                        'content': translated + " ",
                                    }))
                            untranslated_buffer = sentences[-1]

            if self.generation_active and untranslated_buffer.strip() and lang_info['code'] != 'en':
                translated = translate_from_english(untranslated_buffer, lang_info['code'])
                accumulated_translation += translated
                await self.send(text_data=json.dumps({
                    'type': 'bot_chunk',
                    'message_id': bot_message_id,
                    'content': translated,
                }))

        except asyncio.CancelledError:
            self.generation_active = False
            print(f"[WebSocket] Generation task cancelled for session {self.session_id}")

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Error processing message: {str(e)}',
            }))
            self.generation_active = False

        finally:
            self.generation_active = False
            final_response = accumulated_translation if accumulated_translation else accumulated_english

            # Save full bot message to database
            bot_msg = await self.save_message(
                role='bot',
                content=final_response,
                detected_language=lang_info['code'],
                detected_language_name=lang_info['name'],
                direction=lang_info['direction'],
                translated_content=accumulated_english,
            )

            await self.send(text_data=json.dumps({
                'type': 'bot_chunk_end',
                'message_id': str(bot_msg.id),
                'content': final_response,
            }))

            if conversation and (conversation.title == 'New Chat' or not conversation.title):
                new_title = await self.generate_conversation_title(english_text or user_message)
                conversation.title = new_title
                await database_sync_to_async(conversation.save)()
                await self.send(text_data=json.dumps({
                    'type': 'conversation_title',
                    'session_id': self.session_id,
                    'title': new_title,
                }))

    async def generate_conversation_title(self, first_message):
        try:
            import google.generativeai as genai
            from django.conf import settings
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = f'Generate a short, concise 2-4 word title for a conversation that starts with the prompt: "{first_message[:200]}". Return ONLY the raw title without quotation marks, asterisks, or extra text.'
            response = await asyncio.to_thread(model.generate_content, prompt)
            return response.text.strip().replace('"', '').replace('*', '')
        except Exception as e:
            print("[Title Generation] Error generating title:", e)
            return "New Conversation"

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
