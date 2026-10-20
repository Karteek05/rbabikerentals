"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";

type ToastVariant = "success" | "error" | "info";
type ToastInput = { title: string; message?: string; variant?: ToastVariant };
type Toast = ToastInput & { id: number; variant: ToastVariant };

type ToastContextValue = (toast: ToastInput) => void;
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within ToastProvider.");
  return showToast;
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 5000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.id]);

  const isError = toast.variant === "error";
  const accent = isError ? "border-l-red-600" : toast.variant === "success" ? "border-l-green-600" : "border-l-sky-600";

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 border-l-4 ${accent} bg-white p-4 text-slate-900 shadow-lg`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{toast.title}</p>
        {toast.message ? <p className="mt-1 break-words text-sm text-slate-600">{toast.message}</p> : null}
      </div>
      <button
        type="button"
        className="-mr-1 -mt-1 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const showToast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...input, id, variant: input.variant ?? "success" }].slice(-4));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />)}
      </div>
    </ToastContext.Provider>
  );
}
