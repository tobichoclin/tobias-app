"use client";
import { createContext, useContext, useMemo, useState } from "react";

type Toast = { id: number; title?: string; message: string };
type Ctx = { notify: (message: string, title?: string) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(){
  const c = useContext(ToastCtx);
  if(!c) throw new Error("useToast must be used within <ToastProvider/>");
  return c;
}

export function ToastProvider({ children }:{ children: React.ReactNode }){
  const [items, setItems] = useState<Toast[]>([]);
  const notify = (message: string, title?: string) => {
    const id = Date.now();
    setItems((prev)=>[...prev, {id, title, message}]);
    setTimeout(()=>setItems((prev)=>prev.filter(t=>t.id!==id)), 3500);
  };
  const value = useMemo(()=>({notify}),[]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 space-y-2 z-50">
        {items.map(t=>(
          <div key={t.id} className="rounded-2xl shadow-lg px-4 py-3 bg-[color:var(--fiddo-blue)] text-white">
            {t.title && <div className="font-semibold">{t.title}</div>}
            <div className="text-sm">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
