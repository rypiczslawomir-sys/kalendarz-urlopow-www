@echo off
chcp 65001 > nul
title Kalendarz urlopowy — internet (Cloudflare Tunnel)
cd /d "%~dp0"

where gh >nul 2>&1
if errorlevel 1 (
    echo Brak GitHub CLI — zainstaluj: winget install GitHub.cli
    pause
    exit /b 1
)

where cloudflared >nul 2>&1
if errorlevel 1 (
    echo Instaluje cloudflared...
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
)

if not exist node_modules call npm install

if not exist .env.deploy (
    echo Brak .env.deploy — skopiuj .env.example i ustaw zmienne produkcyjne.
    pause
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%a in (".env.deploy") do (
    if "%%a"=="AUTH_USER" set AUTH_USER=%%b
    if "%%a"=="AUTH_PASSWORD" set AUTH_PASSWORD=%%b
    if "%%a"=="SESSION_SECRET" set SESSION_SECRET=%%b
    if "%%a"=="GITHUB_GIST_ID" set GITHUB_GIST_ID=%%b
)
for /f "delims=" %%t in ('gh auth token') do set GITHUB_TOKEN=%%t
set NODE_ENV=production

echo Uruchamiam serwer...
start "Kalendarz serwer" cmd /c "cd /d %~dp0 && set NODE_ENV=production && set AUTH_USER=%AUTH_USER% && set AUTH_PASSWORD=%AUTH_PASSWORD% && set SESSION_SECRET=%SESSION_SECRET% && set GITHUB_GIST_ID=%GITHUB_GIST_ID% && set GITHUB_TOKEN=%GITHUB_TOKEN% && node server.js"

timeout /t 2 /nobreak > nul
echo.
echo Tunel Cloudflare — publiczny adres pojawi sie ponizej.
echo Login: %AUTH_USER%  Haslo: (z .env.deploy)
echo.
cloudflared tunnel --url http://localhost:5175
