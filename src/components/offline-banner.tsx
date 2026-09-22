"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-softest px-4 py-2 text-sm text-ink">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      You are offline. Messages will send when you are back.
    </div>
  );
}
