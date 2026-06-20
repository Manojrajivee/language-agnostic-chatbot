# LinguaBot — Language Agnostic Chatbot

A multilingual AI chatbot that detects user language automatically, processes messages in English, and responds in the user's original language — with full RTL/LTR rendering support.

## Architecture

```
React Frontend (Vite) ←→ Django Backend (DRF + Channels) ←→ PostgreSQL + Redis
                                      ↕
                          Language Engine (langdetect + deep-translator)
                                      ↕
                              Gemini API (response generation)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Axios |
| Backend | Django 4.2 + DRF + Channels |
| Real-time | WebSocket (Django Channels + Redis) |
| Language Detection | `langdetect` |
| Translation | `deep-translator` (Google Translate) |
| Response Generation | Google Gemini 1.5 Flash |
| Database | PostgreSQL |

## Supported Languages

80+ languages including Arabic, Hindi, French, German, Japanese, Korean, Chinese, Russian, Portuguese, Spanish, Tamil, Telugu, Urdu, Hebrew, and many more.

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Docker (for PostgreSQL + Redis)

### 1. Start databases
```bash
docker-compose up -d
```

### 2. Backend setup
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Start Django server
python manage.py runserver
# OR with WebSocket support (recommended):
daphne -b 0.0.0.0 -p 8000 chatbot.asgi:application
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Open the app
Visit: **http://localhost:5173**

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
SECRET_KEY=your-django-secret-key
GEMINI_API_KEY=your-gemini-api-key   # Get from https://aistudio.google.com
DB_NAME=chatbot_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://localhost:6379
```

## API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/conversations/` | Create conversation session |
| GET | `/api/conversations/{id}/` | Get conversation |
| POST | `/api/chat/{id}/send/` | Send message (REST) |
| GET | `/api/chat/{id}/history/` | Get message history |
| POST | `/api/detect-language/` | Detect text language |
| WS | `ws://localhost:8000/ws/chat/{id}/` | Real-time WebSocket chat |

## Features

- 🌍 **80+ Languages** — Type in any language, get responses in kind
- 🔍 **Auto Detection** — No manual language selection needed
- ↔️ **RTL Support** — Arabic, Hebrew, Urdu render right-to-left
- 💬 **Real-time Chat** — WebSocket with REST fallback
- 💾 **Persistent History** — Conversations stored in PostgreSQL
- 🤖 **AI Responses** — Powered by Google Gemini
- 🎨 **Premium UI** — Dark glassmorphism design
