import uuid
from django.db import models
from django.contrib.auth.models import User


class Conversation(models.Model):
    """Represents a chat session."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='conversations')
    session_id = models.CharField(max_length=128, unique=True, db_index=True)
    title = models.CharField(max_length=255, blank=True, default='New Chat')
    is_pinned = models.BooleanField(default=False)
    is_saved = models.BooleanField(default=False)
    category = models.CharField(max_length=50, default='Personal') # Folders: Work, Study, Personal, Coding
    persona = models.CharField(max_length=50, default='default') # Personas: programming_expert, interview_coach, etc.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Conversation {self.session_id}"


class Message(models.Model):
    """A single message in a conversation."""

    ROLE_CHOICES = [
        ('user', 'User'),
        ('bot', 'Bot'),
    ]

    DIRECTION_CHOICES = [
        ('ltr', 'Left to Right'),
        ('rtl', 'Right to Left'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    # Original content from user / generated response for bot
    content = models.TextField()

    # Language metadata
    detected_language = models.CharField(max_length=10, blank=True, default='en')
    detected_language_name = models.CharField(max_length=64, blank=True, default='English')
    direction = models.CharField(max_length=3, choices=DIRECTION_CHOICES, default='ltr')
    is_override_language = models.BooleanField(default=False)
    attachment = models.FileField(upload_to='uploads/', null=True, blank=True)
    attachment_name = models.CharField(max_length=255, blank=True, default='')

    # For user messages: the English translation used for NLP
    translated_content = models.TextField(blank=True, default='')

    # Feedback reaction
    is_liked = models.BooleanField(null=True, blank=True) # True = Liked, False = Disliked, None = No feedback

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"
