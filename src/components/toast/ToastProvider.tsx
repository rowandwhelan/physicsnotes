"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Toast = { id: number; text: string };
type Ctx = { toast: (text: string, ms?: number) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const toast = useCallback((text: string, ms = 1300) => {
    const id = idRef.current++;
    setList((l) => [...l, { id, text }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), ms);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* viewport */}
      <div className="toast-wrap">
        <div className="flex flex-col gap-2">
          {list.map((t) => (
            <div key={t.id} className="toast" data-state="in" role="status" aria-live="polite">
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
