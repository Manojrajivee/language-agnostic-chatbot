from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id', 'role', 'content',
            'detected_language', 'detected_language_name',
            'direction', 'is_override_language',
            'attachment', 'attachment_name', 'is_liked', 'created_at',
        ]


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Conversation
        fields = [
            'id', 'session_id', 'username', 'title', 'is_pinned',
            'is_saved', 'category', 'persona', 'messages',
            'created_at', 'updated_at'
        ]

