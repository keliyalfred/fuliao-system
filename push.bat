@echo off

echo ============================================
echo   Upload to GitHub
echo ============================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed!
    echo Download: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo [OK] Git found
echo.

cd /d "%~dp0"

if not exist "package.json" (
    echo [ERROR] package.json not found!
    pause
    exit /b 1
)
echo [OK] Project folder confirmed
echo.

echo Please paste your GitHub Token below
echo (the ghp_xxxx code), then press Enter:
echo.
set /p TOKEN=Token: 

if "%TOKEN%"=="" (
    echo [ERROR] Token cannot be empty!
    pause
    exit /b 1
)

if exist ".git" (
    rmdir /s /q ".git" >nul 2>nul
)

echo.
echo [1/5] Setting up Git user...
git config --global user.name "keliyalfred"
git config --global user.email "keliyalfred@users.noreply.github.com"

echo [2/5] Initializing repository...
git init -b main >nul 2>nul
if %errorlevel% neq 0 (
    git init >nul 2>nul
    git checkout -b main >nul 2>nul
)

echo [3/5] Adding all files...
git add --all

echo [4/5] Creating commit...
git commit -m "init" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Commit failed.
    pause
    exit /b 1
)

echo [5/5] Pushing to GitHub...
git remote remove origin >nul 2>nul
git remote add origin https://keliyalfred:%TOKEN%@github.com/keliyalfred/fuliao-system.git
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   SUCCESS!
    echo ============================================
    echo.
    echo   Open: https://github.com/keliyalfred/fuliao-system
    echo.
) else (
    echo.
    echo ============================================
    echo   FAILED - Screenshot this and send to me
    echo ============================================
    echo.
)

pause
