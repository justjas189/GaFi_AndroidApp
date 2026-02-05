@echo off
echo ========================================
echo Financial Mascot Backend Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7+ and try again
    pause
    exit /b 1
)

echo Python found: 
python --version

REM Check if pip is available
pip --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: pip is not installed or not in PATH
    pause
    exit /b 1
)

echo.
echo Installing Python dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup completed successfully!
echo ========================================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo NOTICE: .env file not found
    echo Please copy .env.example to .env and configure your Supabase credentials
    echo.
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy ".env.example" ".env"
        echo Please edit .env file with your actual Supabase credentials
    )
    echo.
)

echo To start the server, run: python app.py
echo The mascot backend will be available at: http://localhost:5000
echo.
echo Don't forget to:
echo 1. Configure your .env file with Supabase credentials
echo 2. Ensure the required database tables exist
echo 3. Update your React Native app to point to this backend
echo.
pause
