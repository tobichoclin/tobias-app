import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

async function getValidAccessToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.mercadolibreRefreshToken || !user.mercadolibreTokenExpiresAt) {
    throw new Error('Usuario no conectado a Mercado Libre.');
  }

  if (new Date() > new Date(user.mercadolibreTokenExpiresAt.getTime() - 5 * 60 * 1000)) {
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
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

  return user.mercadolibreAccessToken;
}

function generateCouponCode() {
  return 'PROMO-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(sessionToken, secret);
    const userId = payload.userId as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }

    const accessToken = await getValidAccessToken(userId);

    // Obtener clientes con al menos 2 compras
    const customers = await prisma.customer.findMany({
      where: { userId },
      include: { _count: { select: { orders: true } } },
    });

    const recurrentCustomers = customers.filter((c) => c._count.orders >= 2);

    const promotionsSent: { customerId: string; coupon: string }[] = [];

    for (const customer of recurrentCustomers) {
      const lastOrder = await prisma.order.findFirst({
        where: { customerId: customer.id },
        orderBy: { orderDate: 'desc' },
      });

      if (!lastOrder) continue;

      const coupon = generateCouponCode();
      const message = `¡Gracias por tus compras! Usa el cupón ${coupon} para un 10% de descuento en tu próxima compra.`;

      try {
        await fetch(
          `https://api.mercadolibre.com/messages/packs/${lastOrder.mercadolibreOrderId.toString()}/sellers/${user.mercadolibreId}?tag=post_sale`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: { user_id: Number(user.mercadolibreId) },
              to: { user_id: Number(customer.mercadolibreId) },
              text: message,
            }),
          }
        );
      } catch (err) {
        console.error('Error enviando promoción:', err);
        continue;
      }

      // Canal alternativo: email
      if (customer.email) {
        console.log(`Enviar email a ${customer.email} con cupón ${coupon}`);
      }

      promotionsSent.push({ customerId: customer.id, coupon });
    }

    return NextResponse.json({ success: true, promotionsSent }, { status: 200 });
  } catch (error) {
    console.error('Error enviando promociones:', error);
    return NextResponse.json({ message: 'Error en el servidor' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

