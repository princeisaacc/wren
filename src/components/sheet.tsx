"use client";

import { useEffect, useRef } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

// Bottom sheet on phones, centered dialog on larger screens.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 animate-fade bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[90dvh] w-full animate-sheet overflow-y-auto rounded-t-xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none md:max-w-md md:rounded-xl md:pb-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded bg-line md:hidden" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
