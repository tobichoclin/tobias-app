// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. Obtener el token de la cookie del navegador
    const cookieStore = cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar el token para obtener el ID del usuario (userId)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;

    if (!userId) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 401 });
    }

    // 3. Buscar en la base de datos SÓLO los productos de ese usuario
    const products = await prisma.product.findMany({
      where: {
        userId: userId,
      },
    });

    // 4. Devolver los productos encontrados
    return NextResponse.json(products, { status: 200 });

  } catch (error) {
    console.error('Error al obtener productos:', error);
    return NextResponse.json({ message: 'Error en el servidor' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}