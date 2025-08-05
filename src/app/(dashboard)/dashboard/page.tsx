'use client';

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const appId = process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID;
const redirectUri = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI;
  const handleMercadoLibreConnect = () => {
    // La URL de autorización para Argentina es auth.mercadolibre.com.ar
    const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${appId}&redirect_uri=${redirectUri}`;
    window.location.href = authUrl;
  };

  const handleLogout = async () => { /* ... tu función de logout ... */ };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="rounded-lg bg-white p-8 text-center shadow-md">
        <h1 className="text-4xl font-bold">¡Bienvenido al Dashboard!</h1>
        <p className="mt-4 text-gray-600">Conecta tu cuenta para empezar.</p>

        <button
          onClick={handleMercadoLibreConnect}
          className="mt-8 rounded-md bg-yellow-400 px-6 py-3 font-bold text-gray-800 transition-colors hover:bg-yellow-500"
        >
          Conectar con Mercado Libre
        </button>

        <button
          onClick={handleLogout}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}