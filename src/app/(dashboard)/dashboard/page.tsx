'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, Fragment } from 'react';
import Modal from '@/components/Modal';
import Notification from '@/components/Notification';

// --- Funciones para PKCE ---
function base64URLEncode(str: Buffer) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(Buffer.from(digest));
}
// --- Fin de Funciones ---

interface UserProfile {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
  mercadolibre: {
    connected: boolean;
    userId?: string;
    expiresAt?: string;
    profile?: {
      nickname: string;
      first_name: string;
      last_name: string;
      email: string;
      permalink: string;
    };
  };
}

interface Customer {
  id: string;
  mercadolibreId: string;
  nickname: string;
  firstName?: string | null;
  lastName?: string | null;
  purchaseCount: number;
  lastOrderId?: string | null;
  lastShippingMethod?: string | null;
  province?: string | null;
}

interface MLProduct {
  id: string;
  title: string;
  price: number;
  thumbnail: string;
  available_quantity: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [purchaseFilter, setPurchaseFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [availableProvinces, setAvailableProvinces] = useState<string[]>([]);
  const [products, setProducts] = useState<MLProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [promotionData, setPromotionData] = useState<
    Record<string, { link: string; promotionId: string; expiresAt: string }>
  >({});
  const [notification, setNotification] = useState<string | null>(null);
  const [messageModal, setMessageModal] = useState<{ open: boolean; customer?: Customer; text: string }>({ open: false, text: '' });
  const [bulkModal, setBulkModal] = useState<{ open: boolean; text: string }>({ open: false, text: '' });
  const [promotionModal, setPromotionModal] = useState<{ open: boolean; productId?: string; discount: string; days: string }>({ open: false, discount: '', days: '' });
  const [disconnectModal, setDisconnectModal] = useState(false);
  const appId = process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID;
  const redirectUri = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI;

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      let match = true;
      if (purchaseFilter === '1') match = match && c.purchaseCount === 1;
      else if (purchaseFilter === '1-5')
        match = match && c.purchaseCount > 1 && c.purchaseCount <= 5;
      else if (purchaseFilter === '5-10')
        match = match && c.purchaseCount > 5 && c.purchaseCount <= 10;
      else if (purchaseFilter === '10+')
        match = match && c.purchaseCount > 10;
      if (provinceFilter) match = match && c.province === provinceFilter;
      return match;
    });
  }, [customers, purchaseFilter, provinceFilter]);

  // Cargar perfil del usuario al montar el componente
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data);
        } else {
          console.error('Error cargando perfil del usuario');
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCustomers = async () => {
      try {
        const response = await fetch('/api/customers');
        if (response.ok) {
          const data: Customer[] = await response.json();
          setCustomers(data);
          const provs = Array.from(
            new Set(
              data
                .map((c) => c.province)
                .filter((p): p is string => Boolean(p))
            )
          ).sort();
          setAvailableProvinces(provs);
        } else {
          console.error('Error cargando clientes');
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setCustomersLoading(false);
      }
    };

    fetchUserProfile();
    fetchCustomers();

    // Verificar si hay mensajes de error o éxito en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');
    
    if (error === 'MLAccountAlreadyLinked') {
      setNotification('Esta cuenta de MercadoLibre ya está conectada a otro usuario. Por favor, usa una cuenta diferente.');
    } else if (error === 'TokenError') {
      setNotification('Error al conectar con MercadoLibre. Por favor, inténtalo de nuevo.');
    } else if (success === 'true') {
      setNotification('¡Conexión con MercadoLibre exitosa!');
      // Recargar el perfil para mostrar la nueva conexión
      fetchUserProfile();
      fetchCustomers();
    }

    // Limpiar los parámetros de la URL
    if (error || success) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Error al obtener productos');
        const data: MLProduct[] = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Error al obtener productos:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    if (userProfile?.mercadolibre.connected) {
      fetchProducts();
    } else {
      setProductsLoading(false);
    }
  }, [userProfile]);

  const handleSendMessage = (customer: Customer) => {
    setMessageModal({ open: true, customer, text: '' });
  };

  const submitMessage = async () => {
    if (!messageModal.customer || !messageModal.text) return;
    try {
      const response = await fetch(`/api/customers/${messageModal.customer.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageModal.text, orderId: messageModal.customer.lastOrderId }),
      });
      if (response.ok) {
        setNotification('Mensaje enviado');
      } else {
        setNotification('No se pudo enviar el mensaje');
      }
    } catch (error) {
      console.error('Error:', error);
      setNotification('No se pudo enviar el mensaje');
    } finally {
      setMessageModal({ open: false, customer: undefined, text: '' });
    }
  };

  const handleSendMessageAll = () => {
    if (filteredCustomers.length === 0) {
      setNotification('No hay compradores para enviar mensajes.');
      return;
    }
    setBulkModal({ open: true, text: '' });
  };

  const submitBulkMessage = async () => {
    if (!bulkModal.text) return;
    try {
      const responses = await Promise.all(
        filteredCustomers.map((customer) =>
          fetch(`/api/customers/${customer.id}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: bulkModal.text, orderId: customer.lastOrderId }),
          })
        )
      );
      const failed = responses.filter((r) => !r.ok);
      if (failed.length > 0) {
        setNotification(`Mensajes enviados con ${failed.length} errores.`);
      } else {
        setNotification('Mensajes enviados');
      }
    } catch (error) {
      console.error('Error enviando mensajes:', error);
      setNotification('No se pudieron enviar los mensajes');
    } finally {
      setBulkModal({ open: false, text: '' });
    }
  };

  const handleProductPromotion = (productId: string) => {
    setPromotionModal({ open: true, productId, discount: '', days: '' });
  };

  const submitPromotion = async () => {
    const discount = Number(promotionModal.discount);
    const days = Number(promotionModal.days);
    if (
      !promotionModal.productId ||
      isNaN(discount) ||
      discount <= 0 ||
      isNaN(days) ||
      days <= 0
    ) {
      setNotification('Datos inválidos');
      return;
    }
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await fetch(`/api/products/${promotionModal.productId}/promotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount, expiresAt }),
      });
      let data: {
        permalink?: string;
        promotionId?: string;
        expiresAt?: string;
        message?: string;
        details?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        console.error('Promotion request failed:', data);
        setNotification(`${data.message || 'No se pudo aplicar la promoción'}${data.details ? `: ${data.details}` : ''}`);
        return;
      }
      if (data.permalink && data.promotionId && data.expiresAt) {
        setPromotionData((prev) => ({
          ...prev,
          [promotionModal.productId as string]: {
            link: data.permalink!,
            promotionId: data.promotionId!,
            expiresAt: data.expiresAt!,
          },
        }));
      }
      setNotification('Promoción aplicada');
    } catch (error) {
      console.error('Error setting promotion:', error);
      setNotification('No se pudo aplicar la promoción');
    } finally {
      setPromotionModal({ open: false, productId: undefined, discount: '', days: '' });
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setNotification('Link copiado');
  };

  const handleMercadoLibreDisconnect = () => {
    setDisconnectModal(true);
  };

  const confirmDisconnect = async () => {
    try {
      const response = await fetch('/api/auth/mercadolibre/disconnect', {
        method: 'POST',
      });
      if (response.ok) {
        setNotification('Cuenta de MercadoLibre desconectada exitosamente');
        const profileResponse = await fetch('/api/user/profile');
        if (profileResponse.ok) {
          const data = await profileResponse.json();
          setUserProfile(data);
        }
      } else {
        setNotification('Error al desconectar la cuenta');
      }
    } catch (error) {
      console.error('Error:', error);
      setNotification('Error al desconectar la cuenta');
    } finally {
      setDisconnectModal(false);
    }
  };

  const handleMercadoLibreConnect = async () => {
    const codeVerifier = base64URLEncode(Buffer.from(window.crypto.getRandomValues(new Uint8Array(32))));
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Guardar el code_verifier en una cookie del cliente (accesible desde el servidor)
    document.cookie = `pkce_code_verifier=${codeVerifier}; path=/; max-age=300; SameSite=Lax`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: appId!,
      redirect_uri: redirectUri!,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Usar localhost en lugar de la URL de ngrok para desarrollo local
    const authUrl = `https://auth.mercadolibre.com.ar/authorization?${params.toString()}`;
    window.location.href = authUrl;
  };

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fiddo-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Fragment>
      {notification && (
        <Notification message={notification} onClose={() => setNotification(null)} />
      )}
      <Modal
        title="Enviar mensaje"
        isOpen={messageModal.open}
        onClose={() => setMessageModal({ open: false, customer: undefined, text: '' })}
        actions={
          <>
            <button
              onClick={() => setMessageModal({ open: false, customer: undefined, text: '' })}
              className="rounded bg-gray-200 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={submitMessage}
              className="rounded bg-fiddo-blue px-3 py-1 text-white"
            >
              Enviar
            </button>
          </>
        }
      >
        <textarea
          value={messageModal.text}
          onChange={(e) => setMessageModal({ ...messageModal, text: e.target.value })}
          className="w-full rounded border p-2"
          rows={4}
        />
      </Modal>
      <Modal
        title="Mensaje para compradores"
        isOpen={bulkModal.open}
        onClose={() => setBulkModal({ open: false, text: '' })}
        actions={
          <>
            <button
              onClick={() => setBulkModal({ open: false, text: '' })}
              className="rounded bg-gray-200 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={submitBulkMessage}
              className="rounded bg-fiddo-blue px-3 py-1 text-white"
            >
              Enviar
            </button>
          </>
        }
      >
        <textarea
          value={bulkModal.text}
          onChange={(e) => setBulkModal({ ...bulkModal, text: e.target.value })}
          className="w-full rounded border p-2"
          rows={4}
        />
      </Modal>
      <Modal
        title="Promoción"
        isOpen={promotionModal.open}
        onClose={() => setPromotionModal({ open: false, productId: undefined, discount: '', days: '' })}
        actions={
          <>
            <button
              onClick={() => setPromotionModal({ open: false, productId: undefined, discount: '', days: '' })}
              className="rounded bg-gray-200 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={submitPromotion}
              className="rounded bg-fiddo-blue px-3 py-1 text-white"
            >
              Aplicar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Porcentaje de descuento</label>
            <input
              type="number"
              value={promotionModal.discount}
              onChange={(e) => setPromotionModal({ ...promotionModal, discount: e.target.value })}
              className="mt-1 w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Vigencia (días)</label>
            <input
              type="number"
              value={promotionModal.days}
              onChange={(e) => setPromotionModal({ ...promotionModal, days: e.target.value })}
              className="mt-1 w-full rounded border p-2"
            />
          </div>
        </div>
      </Modal>
      <Modal
        title="Desconectar cuenta"
        isOpen={disconnectModal}
        onClose={() => setDisconnectModal(false)}
        actions={
          <>
            <button
              onClick={() => setDisconnectModal(false)}
              className="rounded bg-gray-200 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDisconnect}
              className="rounded bg-fiddo-orange px-3 py-1 text-white"
            >
              Confirmar
            </button>
          </>
        }
      >
        <p>¿Estás seguro de que quieres desconectar tu cuenta de MercadoLibre?</p>
      </Modal>
      <div className="min-h-screen bg-fiddo-blue/10 py-8">
        <div className="max-w-4xl mx-auto px-4">
        {/* Header del Dashboard */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-fiddo-blue">Fiddo</h1>
              <p className="text-gray-600 mt-1">¡Bienvenido, {userProfile?.user.name}!</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md bg-fiddo-orange px-4 py-2 font-semibold text-white transition-colors hover:bg-fiddo-turquoise"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Información del Usuario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Tu Cuenta</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">Email:</span>
                <span className="ml-2 font-medium">{userProfile?.user.email}</span>
              </div>
              <div>
                <span className="text-gray-600">Miembro desde:</span>
                <span className="ml-2 font-medium">
                  {userProfile?.user.createdAt && new Date(userProfile.user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Estado de MercadoLibre */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">MercadoLibre</h2>
            {userProfile?.mercadolibre.connected ? (
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-green-700 font-medium">Conectado</span>
                </div>
                {userProfile.mercadolibre.profile && (
                  <>
                    <div>
                      <span className="text-gray-600">Usuario:</span>
                      <span className="ml-2 font-medium">{userProfile.mercadolibre.profile.nickname}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Nombre:</span>
                      <span className="ml-2 font-medium">
                        {userProfile.mercadolibre.profile.first_name} {userProfile.mercadolibre.profile.last_name}
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-gray-600">Token expira:</span>
                  <span className="ml-2 font-medium">
                    {userProfile.mercadolibre.expiresAt && 
                      new Date(userProfile.mercadolibre.expiresAt).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={handleMercadoLibreDisconnect}
                  className="w-full rounded-md bg-fiddo-orange/20 px-4 py-2 font-medium text-fiddo-orange transition-colors hover:bg-fiddo-orange/30"
                >
                  Desconectar cuenta
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                  <span className="text-gray-600">No conectado</span>
                </div>
                <button
                  onClick={handleMercadoLibreConnect}
                  className="w-full rounded-md bg-fiddo-turquoise px-4 py-2 font-bold text-white transition-colors hover:bg-fiddo-blue"
                >
                  Conectar con MercadoLibre
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Listado de compradores */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Compradores</h2>
          <div className="flex flex-wrap items-center mb-4 gap-4">
            <div className="flex items-center">
              <label className="mr-2 text-sm text-gray-700">Compras:</label>
              <select
                value={purchaseFilter}
                onChange={(e) => setPurchaseFilter(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="">Todas</option>
                <option value="1">1 compra</option>
                <option value="1-5">Entre 1 y 5</option>
                <option value="5-10">Entre 5 y 10</option>
                <option value="10+">Más de 10</option>
              </select>
            </div>
            <div className="flex items-center">
              <label className="mr-2 text-sm text-gray-700">Ubicación:</label>
              <select
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="">Todas</option>
                {availableProvinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSendMessageAll}
              className="ml-auto rounded bg-fiddo-blue px-3 py-1 text-sm font-medium text-white hover:bg-fiddo-turquoise"
            >
              Enviar mensaje a todos
            </button>
          </div>
          {customersLoading ? (
            <p className="text-gray-600">Cargando...</p>
          ) : filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">ID</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Nickname</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Nombre</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Provincia</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Compras</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{customer.mercadolibreId}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{customer.nickname}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {customer.firstName || customer.lastName
                              ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
                              : 'N/A'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{customer.province || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{customer.purchaseCount}</td>
                          <td className="px-4 py-2 text-sm">
                            <button
                              onClick={() => handleSendMessage(customer)}
                              className="text-fiddo-blue hover:underline"
                            >
                              Enviar mensaje
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600">Aún no hay compradores.</p>
          )}
        </div>

        {/* Productos activos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Productos</h2>
          {productsLoading ? (
            <p className="text-gray-600">Cargando...</p>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="border rounded-lg overflow-hidden shadow hover:shadow-lg transition"
                >
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {product.title}
                    </h3>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      ${product.price}
                    </p>
                    <p className="text-sm text-gray-600">
                      Stock: {product.available_quantity}
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        onClick={() => handleProductPromotion(product.id)}
                        className="rounded bg-fiddo-orange px-2 py-1 text-sm font-medium text-white hover:bg-fiddo-turquoise"
                      >
                        Poner en promoción
                      </button>
                      {promotionData[product.id]?.link && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() =>
                              handleCopyLink(promotionData[product.id].link)
                            }
                            className="rounded bg-fiddo-blue px-2 py-1 text-sm font-medium text-white hover:bg-fiddo-turquoise"
                          >
                            Copiar link
                          </button>
                          <p className="text-xs text-gray-600">
                            Expira: {new Date(promotionData[product.id].expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No tienes productos activos.</p>
          )}
        </div>
        </div>
      </div>
    </Fragment>
  );
}