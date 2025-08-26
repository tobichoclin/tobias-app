"use client";
import { useEffect, useRef } from "react";

export default function Modal({
  open, title, children, onClose, onConfirm, confirmText="Confirmar"
}: {
  open: boolean; title: string; children: React.ReactNode;
  onClose: ()=>void; onConfirm?: ()=>void; confirmText?: string;
}){
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const d = ref.current;
    if(!d) return;
    if(open && !d.open) d.showModal();
    if(!open && d.open) d.close();
  },[open]);
  return (
    <dialog ref={ref} className="rounded-2xl p-0 border shadow-xl w-full max-w-md backdrop:bg-black/30">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-[color:var(--fiddo-blue)]">{title}</h3>
        <div className="mt-3 text-sm text-neutral-700">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-xl border">Cancelar</button>
          {onConfirm && (
            <button onClick={onConfirm} className="px-3 py-2 rounded-xl text-white bg-[color:var(--fiddo-orange)] hover:bg-[color:var(--fiddo-orange-600)]">
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
