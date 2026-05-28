@echo off
chcp 65001 > nul
title Kalendarz urlopowy — wdrożenie na Render (stały link)
cd /d "%~dp0"

echo.
echo ============================================================
echo   STAŁY LINK W INTERNECIE — Render.com (darmowy plan)
echo ============================================================
echo.
echo 1. Za chwilę otworzy się strona Render (logowanie GitHub).
echo 2. Kliknij "Deploy Blueprint" / "Apply".
echo 3. Wklej zmienne środowiskowe z pliku:
echo    RENDER-ENV.local.txt
echo    (4 sekrety: AUTH_PASSWORD, SESSION_SECRET, GITHUB_GIST_ID, GITHUB_TOKEN)
echo 4. Po deployu adres będzie np.:
echo    https://kalendarz-urlopow.onrender.com/login.html
echo.
echo WAŻNE: GITHUB_TOKEN z gh auth token wygasa po czasie.
echo Po wdrożeniu utwórz stały token na GitHub:
echo   https://github.com/settings/tokens/new?scopes=gist
echo i podmień GITHUB_TOKEN w panelu Render.
echo.

if not exist RENDER-ENV.local.txt (
    echo Generuje RENDER-ENV.local.txt...
    where gh >nul 2>&1
    if errorlevel 1 (
        echo Brak GitHub CLI — zainstaluj: winget install GitHub.cli
        pause
        exit /b 1
    )
    for /f "delims=" %%t in ('gh auth token') do set GH_TOKEN=%%t
    for /f "usebackq tokens=1,* delims==" %%a in (".env.deploy") do (
        if "%%a"=="AUTH_USER" set AUTH_USER=%%b
        if "%%a"=="AUTH_PASSWORD" set AUTH_PASSWORD=%%b
        if "%%a"=="SESSION_SECRET" set SESSION_SECRET=%%b
        if "%%a"=="GITHUB_GIST_ID" set GITHUB_GIST_ID=%%b
    )
    (
        echo AUTH_USER=%AUTH_USER%
        echo AUTH_PASSWORD=%AUTH_PASSWORD%
        echo SESSION_SECRET=%SESSION_SECRET%
        echo GITHUB_GIST_ID=%GITHUB_GIST_ID%
        echo GITHUB_TOKEN=%GH_TOKEN%
    ) > RENDER-ENV.local.txt
)

start "" "https://dashboard.render.com/blueprint/new?repo=https://github.com/rypiczslawomir-sys/kalendarz-urlopow-www"
notepad RENDER-ENV.local.txt
echo.
echo Gdy deploy się skończy, wpisz stały adres do LINK.txt
pause
