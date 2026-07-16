from django.urls import path
from . import views

urlpatterns = [
    # Auth endpoints
    path('auth/signup/', views.SignupView.as_view(), name='signup'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    
    # Conversations endpoints
    path('conversations/user/', views.UserConversationsView.as_view(), name='user-conversations'),
    path('conversations/link-guest/', views.LinkGuestConversationView.as_view(), name='link-guest'),
    path('conversations/', views.ConversationView.as_view(), name='conversation-create'),
    path('conversations/<str:session_id>/', views.ConversationView.as_view(), name='conversation-detail'),
    path('conversations/<str:session_id>/duplicate/', views.DuplicateConversationView.as_view(), name='conversation-duplicate'),
    
    # Chat & Utilities endpoints
    path('chat/upload/', views.FileUploadView.as_view(), name='file-upload'),
    path('chat/<str:session_id>/send/', views.ChatMessageView.as_view(), name='chat-send'),
    path('chat/<str:session_id>/history/', views.HistoryView.as_view(), name='chat-history'),
    path('messages/<uuid:message_id>/react/', views.ReactMessageView.as_view(), name='message-react'),
    path('detect-language/', views.LanguageDetectView.as_view(), name='detect-language'),
    path('stats/languages/', views.LanguageStatsView.as_view(), name='language-stats'),
]
