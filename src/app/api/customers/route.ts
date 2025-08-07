// src/app/api/customers/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Crear una nueva instancia del cliente Prisma
const prisma = new PrismaClient();

// --- FUNCIÓN HELPER PARA REFRESCAR EL TOKEN DE MELI ---
async function getValidAccessToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.mercadolibreRefreshToken || !user.mercadolibreTokenExpiresAt) {
    throw new Error('Usuario no conectado a Mercado Libre.');
  }

  // Si el token expira en los próximos 5 minutos, lo renovamos
  if (new Date() > new Date(user.mercadolibreTokenExpiresAt.getTime() - 5 * 60 * 1000)) {
    console.log('Token de Mercado Libre expirado o por expirar, renovando...');

    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.MERCADOLIBRE_APP_ID!,
        client_secret: process.env.MERCADOLIBRE_SECRET_KEY!,
        refresh_token: user.mercadolibreRefreshToken,
      }),
    });

    if (!tokenResponse.ok) throw new Error('No se pudo refrescar el token de Mercado Libre.');

    const newTokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

    // Actualizamos los nuevos tokens en la base de datos
    await prisma.user.update({
      where: { id: userId },
      data: {
        mercadolibreAccessToken: newTokens.access_token,
        mercadolibreRefreshToken: newTokens.refresh_token,
        mercadolibreTokenExpiresAt: expiresAt,
      },
    });

    return newTokens.access_token;
  }

  // Si el token actual es válido, lo devolvemos
  return user.mercadolibreAccessToken;
}

// --- API PRINCIPAL PARA OBTENER CLIENTES ---
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(sessionToken, secret);
    const userId = payload.userId as string;

    const accessToken = await getValidAccessToken(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 1. Pedir las órdenes a Mercado Libre
    const ordersResponse = await fetch(`https://api.mercadolibre.com/orders/search?seller=${user?.mercadolibreUserId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!ordersResponse.ok) throw new Error('No se pudieron obtener las órdenes de Mercado Libre.');

    const { results: orders } = await ordersResponse.json();

    // 2. Procesar y guardar cada orden y cliente en nuestra BD
    for (const order of orders) {
      const buyer = order.buyer;

      // Validar que tenemos los datos mínimos necesarios
      if (!buyer || !buyer.id) {
        console.log('Orden sin datos de comprador, omitiendo:', order.id);
        continue;
      }

      // Convertir el ID a BigInt para que coincida con el esquema
      const buyerIdBigInt = BigInt(buyer.id);

      // Usamos `upsert` para crear el cliente si no existe, o actualizarlo si ya existe
      await prisma.customer.upsert({
        where: { mercadolibreId: buyerIdBigInt },
        update: { 
          nickname: buyer.nickname || 'Usuario sin nombre',
          firstName: buyer.first_name || null,
          lastName: buyer.last_name || null,
          email: buyer.email || null,
        },
        create: {
          mercadolibreId: buyerIdBigInt,
          nickname: buyer.nickname || 'Usuario sin nombre',
          firstName: buyer.first_name || null,
          lastName: buyer.last_name || null,
          email: buyer.email || null,
          userId: userId,
        },
      });
    }

    // 3. Devolver la lista de todos los clientes únicos que hemos guardado
    const customers = await prisma.customer.findMany({
      where: { userId: userId },
    });

    return NextResponse.json(customers, { status: 200 });

  } catch (error) {
    console.error('Error al obtener clientes:', error);
    return NextResponse.json({ message: 'Error en el servidor' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}