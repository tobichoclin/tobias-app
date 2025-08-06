@echo off
echo ====================================
echo    TOBIAS APP - INICIO RAPIDO
echo ====================================
echo.
echo URL FIJA configurada: https://75831a4a3168.ngrok-free.app
echo.

echo 1. Limpiando procesos existentes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 /nobreak >nul

echo 2. Iniciando Next.js en puerto 3000...
start "Next.js" cmd /k "cd /d %~dp0 && npm run dev"

echo 3. Esperando a que Next.js inicie...
timeout /t 5 /nobreak >nul

echo 4. Iniciando ngrok con URL fija...
start "ngrok" cmd /k "ngrok http --domain=75831a4a3168.ngrok-free.app 3000"

echo 5. Esperando a que ngrok establezca el túnel...
timeout /t 5 /nobreak >nul

echo ====================================
echo           ✅ SERVICIOS INICIADOS
echo ====================================
echo.
echo 🌐 URL de tu aplicación: https://75831a4a3168.ngrok-free.app
echo 🔗 URL para MercadoLibre: https://75831a4a3168.ngrok-free.app/api/auth/mercadolibre/callback
echo.
echo ✅ Esta URL ya está configurada en el archivo .env
echo ✅ Solo necesitas asegurarte de que esté en MercadoLibre Dashboard
echo.
echo 📋 Verifica que esta URL esté en:
echo    https://developers.mercadolibre.com/
echo.
echo 🖥️  Las aplicaciones están ejecutándose en ventanas separadas
echo 🛑 Para cerrar todo: ejecuta stop-app.bat
echo ====================================

echo.
echo ¿Quieres abrir automáticamente el dashboard de MercadoLibre? (S/N)
set /p OPEN_ML=

if /i "%OPEN_ML%"=="S" (
    start https://developers.mercadolibre.com/
)

echo.
echo ¿Quieres abrir tu aplicación? (S/N)
set /p OPEN_APP=

if /i "%OPEN_APP%"=="S" (
    start https://75831a4a3168.ngrok-free.app
)

pause
