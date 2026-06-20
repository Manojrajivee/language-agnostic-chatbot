@echo off
echo ====================================
echo  LinguaBot — Backend Setup
echo ====================================

echo.
echo [1/4] Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo [2/4] Installing Python dependencies...
pip install -r requirements.txt

echo.
echo [3/4] Copying .env file...
if not exist .env (
    copy .env.example .env
    echo Created .env from template. Please edit it and add your GEMINI_API_KEY.
) else (
    echo .env already exists, skipping.
)

echo.
echo [4/4] Running Django migrations...
python manage.py makemigrations chat
python manage.py migrate

echo.
echo ====================================
echo  Setup complete!
echo.
echo  To start the server:
echo    venv\Scripts\activate
echo    daphne -b 0.0.0.0 -p 8000 chatbot.asgi:application
echo    OR: python manage.py runserver
echo ====================================
pause
