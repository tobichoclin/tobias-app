// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // Si el logout es exitoso en el servidor, redirigimos al login
        router.push('/login');
      } else {
        console.error('Falló el cierre de sesión en el servidor');
      }
    } catch (error) {
      console.error('Error al intentar cerrar sesión:', error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="rounded-lg bg-white p-8 text-center shadow-md">
        <h1 className="text-4xl font-bold">¡Bienvenido al Dashboard!</h1>
        <p className="mt-4 text-gray-600">Esta es una página protegida.</p>
        <button
          onClick={handleLogout}
          className="mt-8 rounded-md bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}