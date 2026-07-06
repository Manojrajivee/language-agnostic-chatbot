import uuid
import os
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer
from language.detector import detect_language, LANGUAGE_NAMES, RTL_LANGUAGES
from language.translator import translate_to_english, translate_from_english
from language.response import generate_response_sync


class SignupView(APIView):
    """Register a new user, mark inactive, and send a verification email."""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '').strip()

        if not username or not password or not email:
            return Response({'error': 'Username, email, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email is already registered.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create user inactive until verified
            user = User.objects.create_user(username=username, email=email, password=password)
            user.is_active = False
            user.save()
            
            # Send verification email
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            verify_link = f"http://localhost:5173/verify-email/{uid}/{token}/"
            
            send_mail(
                subject="Verify Your LinguaBot Account",
                message=(
                    f"Hi {user.username},\n\n"
                    f"Please click the link below to verify and activate your account:\n"
                    f"{verify_link}\n\n"
                    f"Thank you!"
                ),
                from_email=None,
                recipient_list=[user.email],
                fail_silently=False,
            )

            return Response({
                'message': 'Account registered! Please check the terminal console (or email) to verify your account.',
                'username': user.username,
                'email': user.email
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """Authenticate user and return their Auth Token (only if active/verified)."""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()

        if not username or not password:
            return Response({'error': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=username, password=password)
        if not user:
            # Check if user exists but is inactive
            user_exists = User.objects.filter(username=username).first()
            if user_exists and not user_exists.is_active:
                return Response({
                    'error': 'Your account is registered but unverified. Please verify your email first.',
                    'unverified': True,
                    'username': username
                }, status=status.HTTP_403_FORBIDDEN)
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'username': user.username,
            'email': user.email
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Revoke user's Auth Token."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
            return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SendVerificationEmailView(APIView):
    """Re-send verification email for an unverified/inactive account."""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        username = request.data.get('username', '').strip()
        if not username:
            return Response({'error': 'Username is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(username=username).first()
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        if user.is_active:
            return Response({'message': 'Account is already verified.'}, status=status.HTTP_200_OK)
            
        try:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            verify_link = f"http://localhost:5173/verify-email/{uid}/{token}/"
            
            send_mail(
                subject="Verify Your LinguaBot Account",
                message=(
                    f"Hi {user.username},\n\n"
                    f"Please click the link below to verify and activate your account:\n"
                    f"{verify_link}\n\n"
                    f"Thank you!"
                ),
                from_email=None,
                recipient_list=[user.email],
                fail_silently=False,
            )
            return Response({'message': 'Verification email has been re-sent.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ConfirmEmailVerificationView(APIView):
    """Verify activation token and mark user as active."""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')

        if not uidb64 or not token:
            return Response({'error': 'uid and token are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.is_active = True
            user.save()
            
            token_obj, _ = Token.objects.get_or_create(user=user)
            return Response({
                'message': 'Account verified and activated successfully!',
                'token': token_obj.key,
                'username': user.username,
                'email': user.email
            }, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Invalid or expired verification link.'}, status=status.HTTP_400_BAD_REQUEST)


class RequestPasswordResetView(APIView):
    """Request password reset link via email."""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        users = User.objects.filter(email=email)
        if users.exists():
            for user in users:
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                reset_link = f"http://localhost:5173/reset-password/{uid}/{token}/"
                
                send_mail(
                    subject="Reset Your LinguaBot Password",
                    message=(
                        f"Hi {user.username},\n\n"
                        f"You requested to reset your password. Click the link below to reset it:\n"
                        f"{reset_link}\n\n"
                        f"If you did not request this, please ignore this email."
                    ),
                    from_email=None,
                    recipient_list=[email],
                    fail_silently=False,
                )
                
        return Response({'message': 'If a matching account exists, a password reset link has been sent.'}, status=status.HTTP_200_OK)


class ConfirmPasswordResetView(APIView):
    """Complete password reset using token."""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password', '').strip()

        if not uidb64 or not token or not new_password:
            return Response({'error': 'uid, token, and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Invalid or expired password reset link.'}, status=status.HTTP_400_BAD_REQUEST)


class FileUploadView(APIView):
    """Securely upload documents/images (max 5MB) for Gemini processing."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce 5MB limit
        if file_obj.size > 5 * 1024 * 1024:
            return Response({'error': 'File size exceeds the 5MB limit.'}, status=status.HTTP_400_BAD_REQUEST)

        # Allow only popular image and document extensions
        allowed_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.txt', '.doc', '.docx']
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in allowed_extensions:
            return Response({'error': 'Unsupported file format.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Save file in uploads media folder
            unique_filename = f"uploads/{uuid.uuid4().hex}_{file_obj.name}"
            path = default_storage.save(unique_filename, ContentFile(file_obj.read()))
            
            # Build absolute URI
            file_url = request.build_absolute_uri(settings.MEDIA_URL + path)

            return Response({
                'file_url': file_url,
                'file_name': file_obj.name,
                'file_path': path,
                'file_size': file_obj.size,
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserConversationsView(APIView):
    """List all conversations linked to the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = Conversation.objects.filter(user=request.user)
        q = request.query_params.get('q', '').strip()
        if q:
            conversations = conversations.filter(
                Q(title__icontains=q) | Q(messages__content__icontains=q)
            ).distinct()
        serializer = ConversationSerializer(conversations, many=True)
        return Response(serializer.data)


class LinkGuestConversationView(APIView):
    """Link a guest session conversation to the logged-in user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        conversation = get_object_or_404(Conversation, session_id=session_id)
        if conversation.user is None:
            conversation.user = request.user
            conversation.save()
            return Response({'message': 'Conversation successfully linked to your account.'}, status=status.HTTP_200_OK)
        elif conversation.user == request.user:
            return Response({'message': 'Conversation is already linked to your account.'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Conversation belongs to another user.'}, status=status.HTTP_403_FORBIDDEN)


class ConversationView(APIView):
    """Create, retrieve, update or delete a conversation by session_id."""

    def get(self, request, session_id):
        conversation = get_object_or_404(Conversation, session_id=session_id)
        if request.user.is_authenticated and conversation.user is None:
            conversation.user = request.user
            conversation.save()
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data)

    def post(self, request):
        session_id = request.data.get('session_id') or str(uuid.uuid4())
        conversation, created = Conversation.objects.get_or_create(session_id=session_id)
        if request.user.is_authenticated and conversation.user is None:
            conversation.user = request.user
            conversation.save()
        serializer = ConversationSerializer(conversation)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)

    def patch(self, request, session_id):
        conversation = get_object_or_404(Conversation, session_id=session_id)
        if conversation.user and conversation.user != request.user:
            return Response({'error': 'You do not have permission to edit this conversation.'}, status=status.HTTP_403_FORBIDDEN)
        
        title = request.data.get('title')
        is_pinned = request.data.get('is_pinned')
        is_saved = request.data.get('is_saved')
        category = request.data.get('category')
        persona = request.data.get('persona')

        if title is not None:
            conversation.title = title
        if is_pinned is not None:
            conversation.is_pinned = is_pinned
        if is_saved is not None:
            conversation.is_saved = is_saved
        if category is not None:
            conversation.category = category
        if persona is not None:
            conversation.persona = persona

        conversation.save()
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, session_id):
        conversation = get_object_or_404(Conversation, session_id=session_id)
        if conversation.user and conversation.user != request.user:
            return Response({'error': 'You do not have permission to delete this conversation.'}, status=status.HTTP_403_FORBIDDEN)
        
        conversation.delete()
        return Response({'message': 'Conversation deleted successfully.'}, status=status.HTTP_200_OK)


class DuplicateConversationView(APIView):
    """Duplicates an existing conversation and its messages under a new session_id."""
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        old_conv = get_object_or_404(Conversation, session_id=session_id)
        if old_conv.user and old_conv.user != request.user:
            return Response({'error': 'You do not have permission to duplicate this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        new_session_id = str(uuid.uuid4())
        new_conv = Conversation.objects.create(
            user=request.user,
            session_id=new_session_id,
            title=f"{old_conv.title} (Copy)",
            is_pinned=False,
            is_saved=old_conv.is_saved,
            category=old_conv.category,
            persona=old_conv.persona
        )

        messages_to_create = []
        for msg in old_conv.messages.all():
            messages_to_create.append(Message(
                conversation=new_conv,
                role=msg.role,
                content=msg.content,
                detected_language=msg.detected_language,
                detected_language_name=msg.detected_language_name,
                direction=msg.direction,
                is_override_language=msg.is_override_language,
                attachment=msg.attachment,
                attachment_name=msg.attachment_name,
                translated_content=msg.translated_content,
                is_liked=msg.is_liked
            ))
        Message.objects.bulk_create(messages_to_create)

        serializer = ConversationSerializer(new_conv)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReactMessageView(APIView):
    """Endpoint to rate (like/dislike) a message."""
    permission_classes = [AllowAny]

    def post(self, request, message_id):
        message = get_object_or_404(Message, id=message_id)
        if message.conversation.user and message.conversation.user != request.user:
            return Response({'error': 'You do not have permission to react to this message.'}, status=status.HTTP_403_FORBIDDEN)

        is_liked = request.data.get('is_liked')
        message.is_liked = is_liked
        message.save()

        return Response({'message': 'Reaction updated successfully.', 'is_liked': message.is_liked}, status=status.HTTP_200_OK)


class ChatMessageView(APIView):
    """REST endpoint for sending messages (fallback when WebSocket unavailable)."""

    def post(self, request, session_id):
        user_message = request.data.get('message', '').strip()
        override_lang = request.data.get('override_language', '').strip()
        attachment_path = request.data.get('attachment_path', '').strip()
        attachment_name = request.data.get('attachment_name', '').strip()
        
        if not user_message and not attachment_path:
            return Response({'error': 'Message text or attachment is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create conversation
        conversation, _ = Conversation.objects.get_or_create(session_id=session_id)
        if request.user.is_authenticated and conversation.user is None:
            conversation.user = request.user
            conversation.save()

        # Determine language details
        is_override = False
        if override_lang and override_lang in LANGUAGE_NAMES:
            lang_code = override_lang
            lang_name = LANGUAGE_NAMES[override_lang]
            lang_dir = 'rtl' if override_lang in RTL_LANGUAGES else 'ltr'
            lang_info = {'code': lang_code, 'name': lang_name, 'direction': lang_dir}
            is_override = True
        else:
            # Use message text if present, fallback to English for purely file-based chat
            lang_info = detect_language(user_message) if user_message else {'code': 'en', 'name': 'English', 'direction': 'ltr'}

        # Save user message
        Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_message,
            detected_language=lang_info['code'],
            detected_language_name=lang_info['name'],
            direction=lang_info['direction'],
            is_override_language=is_override,
            attachment=attachment_path or None,
            attachment_name=attachment_name,
        )

        # Translate → NLP → translate back
        english_text = translate_to_english(user_message, lang_info['code']) if user_message else ''
        
        # Call Gemini response generator (with attachment if present)
        english_response = generate_response_sync(english_text, session_id, attachment_path)

        if lang_info['code'] != 'en' and english_response:
            final_response = translate_from_english(english_response, lang_info['code'])
        else:
            final_response = english_response

        # Save bot message
        bot_msg = Message.objects.create(
            conversation=conversation,
            role='bot',
            content=final_response,
            detected_language=lang_info['code'],
            detected_language_name=lang_info['name'],
            direction=lang_info['direction'],
            translated_content=english_response,
        )

        return Response({
            'user_message': {
                'content': user_message,
                'detected_language': lang_info['code'],
                'detected_language_name': lang_info['name'],
                'direction': lang_info['direction'],
                'is_override_language': is_override,
                'attachment': request.build_absolute_uri(settings.MEDIA_URL + attachment_path) if attachment_path else None,
                'attachment_name': attachment_name,
            },
            'bot_message': {
                'content': final_response,
                'detected_language': lang_info['code'],
                'detected_language_name': lang_info['name'],
                'direction': lang_info['direction'],
                'id': str(bot_msg.id),
            },
        }, status=status.HTTP_200_OK)


class HistoryView(APIView):
    """Retrieve chat history for a session."""

    def get(self, request, session_id):
        try:
            conversation = Conversation.objects.get(session_id=session_id)
            messages = conversation.messages.all()
            serializer = MessageSerializer(messages, many=True)
            return Response({
                'session_id': session_id,
                'messages': serializer.data,
            })
        except Conversation.DoesNotExist:
            return Response({'session_id': session_id, 'messages': []})


class LanguageDetectView(APIView):
    """Utility endpoint to detect language of a given text."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        text = request.data.get('text', '')
        if not text:
            return Response({'error': 'text is required'}, status=status.HTTP_400_BAD_REQUEST)
        result = detect_language(text)
        return Response(result)


class LanguageStatsView(APIView):
    """Analytics view returning language breakdown for all user messages."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        user_messages = Message.objects.filter(role='user')
        total_messages = user_messages.count()

        if total_messages == 0:
            return Response({
                'total_messages': 0,
                'languages': []
            })

        # Group by language code and name
        languages_query = user_messages.values('detected_language', 'detected_language_name')\
            .annotate(count=Count('id'))\
            .order_by('-count')

        languages_data = [
            {
                'code': item['detected_language'],
                'name': item['detected_language_name'],
                'count': item['count'],
                'percentage': round((item['count'] / total_messages) * 100, 1)
            }
            for item in languages_query
        ]

        return Response({
            'total_messages': total_messages,
            'languages': languages_data
        })
