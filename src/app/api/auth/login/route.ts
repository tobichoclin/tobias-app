// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Leer los datos (email y password) que envía el front-end
    const body = await request.json();
    const { email, password } = body;

    // ESTO ES IMPORTANTE: El console.log de aquí se verá en la TERMINAL donde corre "npm run dev",
    // no en la consola del navegador.
    console.log('API RECIBIÓ:', { email, password });

    // 2. Lógica de autenticación (próximamente)
    // TODO: Buscar el usuario en la base de datos con el email.
    // TODO: Verificar que la contraseña coincida.
    // TODO: Si todo está bien, generar un token de sesión.

    // 3. Por ahora, solo devolvemos un mensaje de éxito.
    return NextResponse.json({ message: 'Login recibido con éxito' }, { status: 200 });

  } catch (error) {
    // Si hay algún error, devolvemos un mensaje de error.
    return NextResponse.json({ message: 'Error en el servidor', error }, { status: 500 });
  }
}