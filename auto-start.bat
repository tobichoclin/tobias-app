@echo off
setlocal enabledelayedexpansion

echo ====================================
echo    TOBIAS APP - INICIO AUTOMATICO
echo ====================================

echo 1. Limpiando procesos existentes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 /nobreak >nul

echo 2. Iniciando Next.js...
start "Next.js" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 8 /nobreak >nul

echo 3. Iniciando ngrok...
start "ngrok" cmd /k "ngrok http 3000"
echo Esperando a que ngrok inicie...
timeout /t 8 /nobreak >nul

echo 4. Obteniendo URL de ngrok...
set RETRY_COUNT=0
:retry_ngrok
set /a RETRY_COUNT+=1
echo Intento !RETRY_COUNT! - Consultando API de ngrok...

powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels' -TimeoutSec 5; if ($response.tunnels.Count -gt 0) { Write-Host $response.tunnels[0].public_url } else { Write-Host 'NO_TUNNELS' } } catch { Write-Host 'ERROR' }" > temp_ngrok_url.txt
set /p NGROK_URL=<temp_ngrok_url.txt
del temp_ngrok_url.txt

if "!NGROK_URL!"=="ERROR" (
    echo Error al conectar con ngrok API en puerto 4040
    if !RETRY_COUNT! LSS 5 (
        echo Reintentando en 3 segundos...
        timeout /t 3 /nobreak >nul
        goto retry_ngrok
    ) else (
        echo ERROR: No se pudo obtener la URL de ngrok después de 5 intentos
        echo Por favor, verifica que ngrok esté instalado y funcionando
        pause
        exit /b 1
    )
)

if "!NGROK_URL!"=="NO_TUNNELS" (
    echo ngrok API responde pero no hay túneles activos
    if !RETRY_COUNT! LSS 8 (
        echo Esperando a que ngrok establezca el túnel...
        timeout /t 3 /nobreak >nul
        goto retry_ngrok
    ) else (
        echo ERROR: ngrok no pudo establecer el túnel
        pause
        exit /b 1
    )
)

if "!NGROK_URL!"=="" (
    echo Respuesta vacía de ngrok
    if !RETRY_COUNT! LSS 5 (
        echo Reintentando...
        timeout /t 3 /nobreak >nul
        goto retry_ngrok
    ) else (
        echo ERROR: No se pudo obtener URL válida
        pause
        exit /b 1
    )
)

echo URL obtenida: !NGROK_URL!

echo 5. Actualizando configuracion...
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

echo 6. Reiniciando Next.js con nueva configuracion...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
start "Next.js Updated" cmd /k "cd /d %~dp0 && npm run dev"

echo ====================================
echo           SERVICIOS LISTOS
echo ====================================
echo.
echo URL de la aplicacion: !NGROK_URL!
echo URL para MercadoLibre: !NGROK_URL!/api/auth/mercadolibre/callback
echo.
echo IMPORTANTE: Actualiza la URL en MercadoLibre Dashboard:
echo https://developers.mercadolibre.com/
echo.
echo Las aplicaciones se ejecutan en segundo plano.
echo Para cerrar, ejecuta: stop-app.bat
echo ====================================

pause
