import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get('pkce_code_verifier')?.value;
  const sessionToken = cookieStore.get('session_token')?.value;

  // --- LOG DE DEBUGGING MEJORADO ---
  console.log('🔍 CALLBACK MERCADOLIBRE - URL completa:', request.url);
  console.log('🔍 CALLBACK MERCADOLIBRE - Variables de entorno:');
  console.log('  - MERCADOLIBRE_REDIRECT_URI:', process.env.MERCADOLIBRE_REDIRECT_URI);
  console.log('  - NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI:', process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI);
  
  console.log('🍪 Todas las cookies disponibles:');
  cookieStore.getAll().forEach(cookie => {
    console.log(`  ${cookie.name}: ${cookie.value}`);
  });
  
  console.log('📝 Verificando parámetros en el callback:', {
    hasCode: !!code,
    hasCodeVerifier: !!codeVerifier,
    hasSessionToken: !!sessionToken,
    codeValue: code,
    codeVerifierValue: codeVerifier,
  });
  // --- FIN DEL LOG MEJORADO ---

  // Validaciones iniciales con error específico
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?error=MissingCode', request.url));
  }
  
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/dashboard?error=MissingSession', request.url));
  }
  
  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/dashboard?error=MissingVerifier', request.url));
  }

  try {
    // ... (el resto del código para obtener y guardar el token se mantiene igual) ...
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MERCADOLIBRE_APP_ID!,
        client_secret: process.env.MERCADOLIBRE_SECRET_KEY!,
        code: code,
        redirect_uri: process.env.MERCADOLIBRE_REDIRECT_URI!,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorDetails = await tokenResponse.json();
      console.error('DETALLES DEL ERROR DE MERCADO LIBRE:', errorDetails);
      throw new Error('Error al obtener el token de Mercado Libre');
    }

    const tokens = await tokenResponse.json();
    console.log('TOKENS DE MERCADO LIBRE RECIBIDOS:', tokens);

    // Verificar el JWT del usuario autenticado
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(sessionToken, secret);
    const userId = payload.userId as string;

    // Verificar si este mercadolibreId ya está asociado a OTRA cuenta
    const existingMLUser = await prisma.user.findUnique({
      where: { mercadolibreId: tokens.user_id.toString() },
      select: { id: true, email: true }
    });

    if (existingMLUser && existingMLUser.id !== userId) {
      console.log('⚠️ Esta cuenta de MercadoLibre ya está conectada a otro usuario:', existingMLUser.email);
      const baseUrl = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI?.replace('/api/auth/mercadolibre/callback', '') || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/dashboard?error=MLAccountAlreadyLinked`);
    }

    // Actualizar tokens (permitir sobrescribir si es el mismo usuario)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mercadolibreId: tokens.user_id.toString(),
        mercadolibreAccessToken: tokens.access_token,
        mercadolibreRefreshToken: tokens.refresh_token,
        mercadolibreTokenExpiresAt: expiresAt,
      },
    });

    console.log('✅ Tokens de MercadoLibre guardados para el usuario:', userId);

    // Crear respuesta de redirección y limpiar la cookie PKCE
    const baseUrl = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI?.replace('/api/auth/mercadolibre/callback', '') || 'http://localhost:3000';
    const response = NextResponse.redirect(`${baseUrl}/dashboard?success=true`);
    response.cookies.set('pkce_code_verifier', '', { 
      maxAge: 0, 
      path: '/' 
    });
    return response;

  } catch (error) {
    console.error('Error en el callback de Mercado Libre:', error);
    const baseUrl = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI?.replace('/api/auth/mercadolibre/callback', '') || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/dashboard?error=TokenError`);
  } finally {
    await prisma.$disconnect();
  }
}