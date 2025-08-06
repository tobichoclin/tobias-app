@echo off
echo ====================================
echo    DETENIENDO TOBIAS APP
echo ====================================

echo Cerrando Next.js...
taskkill /F /IM node.exe 2>nul

echo Cerrando ngrok...
taskkill /F /IM ngrok.exe 2>nul

echo ====================================
echo    SERVICIOS DETENIDOS
echo ====================================

pause
