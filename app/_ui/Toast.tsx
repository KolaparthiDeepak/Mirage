"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./ui.module.css";

const ToastCtx = createContext<((msg: string) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div role="status" className={styles.toast}>
      {children}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const next = useRef(0);

  const push = useCallback((msg: string) => {
    const id = next.current++;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className={styles.toastRegion}>
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
