@echo off
setlocal enabledelayedexpansion

echo ====================================
echo    TOBIAS APP - INICIO SIMPLE
echo ====================================

echo 1. Limpiando procesos existentes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 3 /nobreak >nul

echo 2. Iniciando Next.js en puerto 3000...
start "Next.js" cmd /k "cd /d %~dp0 && npm run dev"

echo 3. Esperando a que Next.js inicie...
timeout /t 5 /nobreak >nul

echo 4. Iniciando ngrok...
start "ngrok" cmd /k "ngrok http 3000"

echo 5. Esperando a que ngrok establezca el túnel...
timeout /t 8 /nobreak >nul

echo ====================================
echo    OBTENIENDO URL DE NGROK
echo ====================================

echo Presiona ENTER después de ver que ngrok esté funcionando
echo (debería mostrar "Session Status: online" en la ventana de ngrok)
pause

echo Consultando API de ngrok...
curl -s http://localhost:4040/api/tunnels > ngrok_response.json

if exist ngrok_response.json (
    for /f "tokens=*" %%i in ('powershell -Command "$json = Get-Content 'ngrok_response.json' | ConvertFrom-Json; $json.tunnels[0].public_url"') do set NGROK_URL=%%i
    del ngrok_response.json
) else (
    echo ERROR: No se pudo obtener respuesta de ngrok
    pause
    exit /b 1
)

if "!NGROK_URL!"=="" (
    echo ERROR: URL de ngrok vacía
    echo Por favor, verifica que ngrok esté funcionando
    pause
    exit /b 1
)

echo URL obtenida: !NGROK_URL!

echo Actualizando archivo .env...
powershell -Command ^
"$content = Get-Content '.env' | ForEach-Object { ^
    if ($_ -match '^MERCADOLIBRE_REDIRECT_URI=') { ^
        'MERCADOLIBRE_REDIRECT_URI=\"!NGROK_URL!/api/auth/mercadolibre/callback\"' ^
    } elseif ($_ -match '^NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI=') { ^
        'NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI=\"!NGROK_URL!/api/auth/mercadolibre/callback\"' ^
    } else { ^
        $_ ^
    } ^
}; ^
$content | Set-Content '.env'"

echo Reiniciando Next.js con nueva configuración...
taskkill /F /IM node.exe 2>nul
timeout /t 3 /nobreak >nul
start "Next.js Updated" cmd /k "cd /d %~dp0 && npm run dev"

echo ====================================
echo           ✅ LISTO PARA USAR
echo ====================================
echo.
echo 🌐 URL de tu aplicación: !NGROK_URL!
echo 🔗 URL para MercadoLibre: !NGROK_URL!/api/auth/mercadolibre/callback
echo.
echo 📋 COPIA esta URL y pégala en:
echo    https://developers.mercadolibre.com/
echo.
echo 🖥️  Las aplicaciones están ejecutándose en ventanas separadas
echo 🛑 Para cerrar todo: ejecuta stop-app.bat
echo ====================================

echo.
echo ¿Quieres abrir automáticamente el dashboard de MercadoLibre? (S/N)
set /p OPEN_ML=

if /i "!OPEN_ML!"=="S" (
    start https://developers.mercadolibre.com/
)

pause
