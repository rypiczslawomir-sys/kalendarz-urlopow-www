@echo off
chcp 65001 > nul
cd /d "%~dp0"

where gh >nul 2>&1
if errorlevel 1 (
    echo Zainstaluj GitHub CLI: winget install GitHub.cli
    pause
    exit /b 1
)

gh auth status >nul 2>&1
if errorlevel 1 (
    echo Zaloguj sie do GitHub w przegladarce...
    gh auth login -p https -w
    if errorlevel 1 exit /b 1
)

echo Tworze repozytorium i wysylam kod...
gh repo create kalendarz-urlopow-www --public --source=. --remote=origin --push
if errorlevel 1 (
    echo.
    echo Jesli repozytorium juz istnieje, sprobuj:
    echo   git remote add origin https://github.com/TWOJ_USER/kalendarz-urlopow-www.git
    echo   git push -u origin main
)
pause
