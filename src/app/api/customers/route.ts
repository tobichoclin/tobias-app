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
    const ordersResponse = await fetch(`https://api.mercadolibre.com/orders/search?seller=${user?.mercadolibreId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!ordersResponse.ok) throw new Error('No se pudieron obtener las órdenes de Mercado Libre.');

    const { results: orders } = await ordersResponse.json();

    // Mapa para llevar la cuenta de compras, ubicación y último envío por comprador
    const buyerStats = new Map<
      string,
      {
        count: number;
        lastOrderId: string;
        lastOrderDate: string;
        lastShippingMethod?: string | null;
        lastProvince?: string | null;
      }
    >();

    interface BuyerDetails {
      first_name?: string;
      last_name?: string;
      email?: string;
    }

    // Cache para detalles de compradores y evitar múltiples llamadas
    const buyerDetailsCache = new Map<string, BuyerDetails>();

    // 2. Procesar y guardar cada orden y cliente en nuestra BD
    for (const order of orders) {
      const buyer = order.buyer;

      // Validar que tenemos los datos mínimos necesarios
      if (!buyer || !buyer.id) {
        console.log('Orden sin datos de comprador, omitiendo:', order.id);
        continue;
      }

      let firstName = buyer.first_name || null;
      let lastName = buyer.last_name || null;
      let email = buyer.email || null;

      let shipping = order.shipping;
      let shippingMethod =
        shipping?.shipping_mode ??
        shipping?.mode ??
        shipping?.logistic_type ??
        null;
      let province =
        shipping?.receiver_address?.state?.name ??
        shipping?.receiver_address?.state ??
        null;

      if (
        !firstName ||
        !lastName ||
        !email ||
        !shipping ||
        !shippingMethod ||
        !province
      ) {
        let details = buyerDetailsCache.get(buyer.id);
        if (!details || !shipping || !shippingMethod || !province) {
          const orderDetailsResponse = await fetch(
            `https://api.mercadolibre.com/orders/${order.id}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (orderDetailsResponse.ok) {
            const orderDetails = await orderDetailsResponse.json();
            details = {
              first_name: orderDetails.buyer?.first_name,
              last_name: orderDetails.buyer?.last_name,
              email: orderDetails.buyer?.email,
            } as BuyerDetails;
            shipping = orderDetails.shipping;
            buyerDetailsCache.set(buyer.id, details);
          }
        }
        firstName = firstName || details?.first_name || null;
        lastName = lastName || details?.last_name || null;
        email = email || details?.email || null;
        shippingMethod =
          shippingMethod ||
          shipping?.shipping_mode ||
          shipping?.mode ||
          shipping?.logistic_type ||
          null;
        province =
          province ||
          shipping?.receiver_address?.state?.name ||
          shipping?.receiver_address?.state ||
          null;
      }

      const buyerIdBigInt = BigInt(buyer.id);

      const buyerIdStr = buyer.id.toString();
      const currentStats = buyerStats.get(buyerIdStr);
      const orderDate = order.date_created;
      const packId = (order.pack_id ?? order.id).toString();

      if ((!shippingMethod || !province) && shipping?.id) {
        try {
          const shippingRes = await fetch(
            `https://api.mercadolibre.com/shipments/${shipping.id}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (shippingRes.ok) {
            const shippingDetails = await shippingRes.json();
            shippingMethod =
              shippingMethod ||
              shippingDetails.shipping_mode ||
              shippingDetails.mode ||
              shippingDetails.logistic_type ||
              null;
            province =
              province ||
              shippingDetails.receiver_address?.state?.name ||
              shippingDetails.receiver_address?.state ||
              null;
          }
        } catch (err) {
          console.error('Error obteniendo envío', order.id, err);
        }
      }
      if (currentStats) {
        currentStats.count += 1;
        if (new Date(orderDate) > new Date(currentStats.lastOrderDate)) {
          currentStats.lastOrderId = packId;
          currentStats.lastOrderDate = orderDate;
          currentStats.lastShippingMethod = shippingMethod;
          currentStats.lastProvince = province;
        }
      } else {
        buyerStats.set(buyerIdStr, {
          count: 1,
          lastOrderId: packId,
          lastOrderDate: orderDate,
          lastShippingMethod: shippingMethod,
          lastProvince: province,
        });
      }

      // Usamos `upsert` para crear el cliente si no existe, o actualizarlo si ya existe
      await prisma.customer.upsert({
        where: { mercadolibreId: buyerIdBigInt },
        update: {
          nickname: buyer.nickname || 'Usuario sin nombre',
          firstName,
          lastName,
          email,
        },
        create: {
          mercadolibreId: buyerIdBigInt,
          nickname: buyer.nickname || 'Usuario sin nombre',
          firstName,
          lastName,
          email,
          userId: userId,
        },
      });
    }

    // 3. Devolver la lista de todos los clientes únicos que hemos guardado
    const customers = await prisma.customer.findMany({
      where: { userId: userId },
    });

    const serializedCustomers = customers.map((c) => {
      const stats = buyerStats.get(c.mercadolibreId.toString());
      return {
        ...c,
        mercadolibreId: c.mercadolibreId.toString(),
        purchaseCount: stats?.count || 0,
        lastOrderId: stats?.lastOrderId || null,
        lastShippingMethod: stats?.lastShippingMethod || null,
        province: stats?.lastProvince || null,
      };
    });

    return NextResponse.json(serializedCustomers, { status: 200 });

  } catch (error) {
    console.error('Error al obtener clientes:', error);
    return NextResponse.json({ message: 'Error en el servidor' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
