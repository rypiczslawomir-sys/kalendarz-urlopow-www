@echo off
chcp 65001 > nul
title Kalendarz urlopowy

cd /d "%~dp0"

if not exist node_modules (
    echo Instaluje zaleznosci...
    call npm install
    if errorlevel 1 exit /b 1
)

if not exist .env (
    echo.
    echo Brak pliku .env — kopiuje .env.example
    copy .env.example .env > nul
    echo Edytuj .env i ustaw AUTH_PASSWORD przed wystawieniem do internetu!
    echo.
)

echo Uruchamiam serwer...
start "" "http://localhost:5175/login.html"
npm start
