'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ToastContext {
  toast: (message: string) => void;
}

const ToastCtx = createContext<ToastContext | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<{ id: number; message: string }[]>([]);

  const toast = (message: string) => {
    const id = Date.now();
    setMessages((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 3000);
  };

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="rounded-md bg-fiddo-orange px-4 py-2 text-white shadow">
            {m.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider/>');
  }
  return ctx;
}
