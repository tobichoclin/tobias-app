@echo off
echo Obteniendo URL de ngrok...

:: Esperar a que ngrok esté listo
timeout /t 5 /nobreak >nul

:: Obtener la URL de ngrok
for /f "tokens=*" %%i in ('powershell -Command "(Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels').tunnels[0].public_url"') do set NGROK_URL=%%i

if "%NGROK_URL%"=="" (
    echo Error: No se pudo obtener la URL de ngrok
    pause
    exit /b 1
)

echo URL de ngrok obtenida: %NGROK_URL%

:: Actualizar el archivo .env
echo Actualizando archivo .env...
powershell -Command ^
"$content = Get-Content '.env' | ForEach-Object { ^
    if ($_ -match '^MERCADOLIBRE_REDIRECT_URI=') { ^
        'MERCADOLIBRE_REDIRECT_URI=\"%NGROK_URL%/api/auth/mercadolibre/callback\"' ^
    } elseif ($_ -match '^NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI=') { ^
        'NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI=\"%NGROK_URL%/api/auth/mercadolibre/callback\"' ^
    } else { ^
        $_ ^
    } ^
}; ^
$content | Set-Content '.env'"

echo ====================================
echo    CONFIGURACION ACTUALIZADA
echo ====================================
echo.
echo URL de ngrok: %NGROK_URL%
echo Redirect URI: %NGROK_URL%/api/auth/mercadolibre/callback
echo.
echo IMPORTANTE: Actualiza esta URL en el dashboard de MercadoLibre:
echo https://developers.mercadolibre.com/
echo ====================================

pause
