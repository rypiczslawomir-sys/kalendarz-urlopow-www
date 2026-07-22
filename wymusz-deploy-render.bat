@echo off
chcp 65001 > nul
title Kalendarz — wymuś deploy na Render
cd /d "%~dp0"

echo.
echo ============================================================
echo   WYMUS DEPLOY NA RENDER (jednorazowo po pushu na GitHub)
echo ============================================================
echo.
echo 1. Zaloguj sie do Render (GitHub).
echo 2. Otworz usluge: kalendarz-urlopow-9vvb
echo 3. Kliknij: Manual Deploy ^> Deploy latest commit
echo 4. Po 2-5 min sprawdz:
echo    https://kalendarz-urlopow-9vvb.onrender.com/login.html
echo    login: admin   haslo: 1947
echo.
echo Opcja API (bez klikania):
echo   Utworz klucz: https://dashboard.render.com/u/settings#api-keys
echo   set RENDER_API_KEY=twoj_klucz
echo   node scripts\deploy-render.js
echo.

start "" "https://dashboard.render.com/"
timeout /t 2 /nobreak > nul
pause
