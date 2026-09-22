"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type LoadingValue = {
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  show: (label: string) => void;
  hide: () => void;
};

const LoadingContext = createContext<LoadingValue>({
  run: (_label, fn) => fn(),
  show: () => {},
  hide: () => {},
});

export const useLoading = () => useContext(LoadingContext);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const count = useRef(0);

  const run = useCallback(async <T,>(text: string, fn: () => Promise<T>) => {
    count.current += 1;
    setLabel(text);
    try {
      return await fn();
    } finally {
      count.current -= 1;
      if (count.current <= 0) setLabel(null);
    }
  }, []);

  const value = useMemo<LoadingValue>(
    () => ({ run, show: (text) => setLabel(text), hide: () => setLabel(null) }),
    [run],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {label && (
        <div role="alert" aria-busy="true" className="fixed inset-0 z-[70] flex animate-fade items-center justify-center bg-black/30 px-4">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-5 py-4 text-sm">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden="true" />
            <span>{label}</span>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}