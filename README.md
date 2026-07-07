# LinguaBot — Premium Language Agnostic Chat Platform

LinguaBot is a production-ready, feature-rich multilingual AI chatbot application. It automatically detects the user's language, translates it to English for Gemini NLP processing, and streams responsive answers back in the user's original language. It supports 80+ languages, dynamic Right-to-Left (RTL) formatting, and features a state-of-the-art UI similar to ChatGPT, Claude, and Gemini.

---

## 🚀 Key Premium Features

- 🌍 **Agnostic Multilingual Pipeline** — Automatically detects 80+ languages (Hindi, Arabic, French, Japanese, Russian, etc.) and translates input/output at boundary levels.
- ⚡ **Word-by-Word Response Streaming** — Leverages async thread execution and queue pools to stream responses back in real-time.
- 🗣️ **Multilingual Text-to-Speech (TTS)** — Speak response reads content aloud in native locales (English, French, Hindi, Portuguese, Spanish, and more).
- 🎤 **Voice Input Recognition** — Press the microphone to type messages using Web Speech API dictation.
- 📁 **Conversations Folder Categories** — Organize chat histories into custom tags (**Work**, **Study**, **Personal**, **Coding**).
- 📌 **Pinned & Starred Chats** — Bookmark important chats to the top of the sidebar.
- 📝 **Markdown & Code Highlighting** — Fully parses markdown headers, lists, tables, and provides code block formatting via `highlight.js` with a dedicated **Copy code** button.
- 📋 **Reactions & Actions** — Rate bot responses (Like/Dislike), copy full messages, and share links to clipboard.
- 🎨 **Adaptive Themes** — Toggle between vibrant Light theme, premium Dark theme, and System Auto-preferences.
- 📥 **Chat Exports** — Export sessions instantly as **TXT**, **Markdown**, or a clean **PDF** layout.
- ⌨️ **Keyboard Shortcuts** — Navigate like a power user: `Ctrl + N` for New Chat, `Ctrl + K` for search focus, and `Enter` / `Ctrl + Enter` to send.

---

## 🛠️ Tech Stack & Libraries

### Frontend
- **Core**: React 19 + Vite
- **Styling**: Modern CSS variables & media query theme resolvers (No Tailwind bloat)
- **Icons**: `lucide-react`
- **Markdown & Highlight**: `react-markdown`, `remark-gfm`, `highlight.js`

### Backend
- **Core**: Django 4.2 + Django REST Framework
- **Real-Time WebSockets**: Django Channels 4.0 + Daphne ASGI
- **Translation & NLP Pipeline**: `langdetect` + `deep-translator` (Google Translate) + `google-generativeai` (Gemini 2.5 Flash)
- **Database**: PostgreSQL (Production) / SQLite (Development fallback)

---

## 📐 Architecture Flow

```
React Frontend (Vite) ← [WebSocket Chunks / REST] → Django Channels (Daphne)
                                                    ↕
                                        Task queue (asyncio.Queue)
                                                    ↕
                                     ThreadExecutor (Gemini Stream)
                                                    ↕
                                        Sentence-Level Translator
```

---

## ⚙️ Environment Variables

Create a `backend/.env` file in the backend root:

```env
SECRET_KEY=your-django-secret-key
DEBUG=True

# Database (PostgreSQL)
DB_NAME=chatbot_db
DB_USER=postgres
DB_PASSWORD=your-postgres-password
DB_HOST=localhost
DB_PORT=5432

# Gemini API Key (Get from https://aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🚀 Quick Start

### 1. Backend Server
Ensure you have active virtualenv setup:
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # On Windows
# source venv/bin/activate # On macOS/Linux

pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

### 2. Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 📡 API & WebSocket Routing

| Protocol | Endpoint | Description |
|--------|---------|-------------|
| **GET** | `/api/conversations/user/` | Fetch authenticated user's conversations |
| **PATCH** | `/api/conversations/{session_id}/` | Rename, Pin, or Tag conversation categories |
| **DELETE** | `/api/conversations/{session_id}/` | Delete conversation history |
| **POST** | `/api/conversations/{session_id}/duplicate/` | Duplicate conversation history |
| **POST** | `/api/messages/{message_id}/react/` | Upvote (Like) / Downvote (Dislike) bot messages |
| **WS** | `ws://localhost:8000/ws/chat/{session_id}/` | WebSocket connection for real-time streaming |



---

## Author

Manoj Rajivee

Full Stack Developer

LinkedIn: www.linkedin.com/in/manojrajivee

GitHub: https://github.com/Manojrajivee

