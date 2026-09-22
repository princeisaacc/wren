"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastOptions = { actionLabel?: string; onAction?: () => void };
type ToastState = { text: string } & ToastOptions;

const ToastContext = createContext<{ show: (text: string, options?: ToastOptions) => void }>({
  show: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((text: string, options?: ToastOptions) => {
    setToast({ text, ...options });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
        {toast && (
          <div className="pointer-events-auto flex max-w-sm animate-fade items-center gap-4 rounded-lg bg-ink px-4 py-3 text-sm text-canvas">
            <span>{toast.text}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}