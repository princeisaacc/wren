"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RouteProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : "idle"));
    const t = setTimeout(() => setState("idle"), 250);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      const href = a?.getAttribute("href");
      if (!a || !href || !href.startsWith("/") || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (href.split("?")[0] === window.location.pathname) return;
      setState("loading");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 10000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (state === "idle") return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5">
      <div className={`h-full bg-brand ${state === "loading" ? "animate-progress" : "w-full"}`} />
    </div>
  );
}