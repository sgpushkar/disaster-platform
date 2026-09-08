@echo off
title Disaster Prediction Platform - Easy Setup
echo ========================================================
echo     AI Disaster Platform - 1-Click Automated Setup
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

echo [1/3] Installing root dependencies...
call npm install --no-audit --no-fund

echo.
echo [2/3] Running automated environment setup and ML model checker...
node setup.js

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo Setup finished successfully!
    echo.
    set /p START_NOW="Do you want to start the platform right now? (Y/N): "
    if /i "%START_NOW%"=="Y" (
        echo Starting platform...
        npm run dev
    )
) else (
    echo [ERROR] Setup encountered an issue. Please review the messages above.
    pause
)
