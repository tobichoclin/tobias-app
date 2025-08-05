import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?error=NoCode', request.url));
  }

  try {
    // Debug: Verificar que las variables de entorno estén cargadas
    console.log('🔍 Verificando variables de entorno:', {
      appId: process.env.MERCADOLIBRE_APP_ID ? '✓ Configurado' : '❌ Falta',
      secret: process.env.MERCADOLIBRE_SECRET_KEY ? '✓ Configurado' : '❌ Falta',
      redirectUri: process.env.MERCADOLIBRE_REDIRECT_URI,
      code: code ? '✓ Recibido' : '❌ Falta'
    });

    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MERCADOLIBRE_APP_ID!,
        client_secret: process.env.MERCADOLIBRE_SECRET_KEY!,
        code: code,
        redirect_uri: process.env.MERCADOLIBRE_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      // --- NUEVA PARTE PARA DEBUGGING ---
      // Leemos la respuesta de error de Mercado Libre y la mostramos en la consola.
      const errorDetails = await tokenResponse.json();
      console.error('DETALLES DEL ERROR DE MERCADO LIBRE:', errorDetails);
      // --- FIN DE LA NUEVA PARTE ---
      throw new Error('Error al obtener el token de Mercado Libre');
    }

    const tokens = await tokenResponse.json();
    console.log('TOKENS DE MERCADO LIBRE RECIBIDOS:', tokens);

    // TODO: Lógica para guardar los tokens

    return NextResponse.redirect(new URL('/dashboard?success=true', request.url));

  } catch (error) {
    // Mantenemos el log y la redirección genérica
    console.error('Error en el callback de Mercado Libre:', error);
    return NextResponse.redirect(new URL('/dashboard?error=TokenError', request.url));
  }
}