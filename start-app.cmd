@echo off
setlocal

echo ================================================
echo   Job Centre Uganda - Start Script
echo ================================================
echo.

cd /d "%~dp0"

REM --- 1. Local infra: Postgres + Redis (safe to run even if already up) ---
echo [1/3] Starting Docker services (Postgres + Redis)...
docker compose up -d
if errorlevel 1 (
    echo   WARNING: Docker Compose failed - is Docker Desktop running?
)
echo.

REM --- 2. API (port 4000) ---
echo [2/3] Checking API on port 4000...
netstat -ano | findstr ":4000 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo   API already running - skipping.
) else (
    echo   API is down - rebuilding and starting it...
    pushd apps\api
    REM Clear the incremental build cache first - a known Prisma/tsc bug on
    REM this project can leave dist/ silently empty otherwise.
    if exist tsconfig.tsbuildinfo del /f /q tsconfig.tsbuildinfo
    if exist dist rmdir /s /q dist
    call npm run build
    if errorlevel 1 (
        echo   ERROR: API build failed - see output above.
        popd
        goto :web
    )
    start "Job Centre API" cmd /k "node dist\main.js"
    popd
    echo   API starting in a new window ^(http://localhost:4000/api/v1^)...
)
echo.

:web
REM --- 3. Web app (port 3000) ---
echo [3/3] Checking Web app on port 3000...
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo   Web app already running - skipping.
) else (
    echo   Web app is down - starting it...
    pushd apps\web
    REM Clear .next in case a stray production build corrupted the dev cache.
    if exist .next rmdir /s /q .next
    start "Job Centre Web" cmd /k "npm run dev"
    popd
    echo   Web app starting in a new window ^(http://localhost:3000^)...
)
echo.

echo ================================================
echo   Done.
echo   API: http://localhost:4000/api/v1
echo   Web: http://localhost:3000
echo ================================================
echo.
pause
endlocal
