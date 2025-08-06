@echo off
echo ====================================
echo    INICIANDO TOBIAS APP
echo ====================================

echo 1. Matando procesos existentes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul

echo 2. Esperando 3 segundos...
timeout /t 3 /nobreak >nul

echo 3. Iniciando Next.js en puerto 3000...
start "Next.js" cmd /k "cd /d %~dp0 && npm run dev"

echo 4. Esperando 5 segundos para que Next.js inicie...
timeout /t 5 /nobreak >nul

echo 5. Iniciando ngrok en puerto 3000...
start "ngrok" cmd /k "ngrok http 3000"

echo 6. Esperando 3 segundos para que ngrok inicie...
timeout /t 3 /nobreak >nul

echo ====================================
echo    SERVICIOS INICIADOS
echo ====================================
echo.
echo Next.js: http://localhost:3000
echo ngrok: Revisar la terminal de ngrok para la URL
echo.
echo Para detener: Cierra las ventanas de terminal
echo ====================================

pause
