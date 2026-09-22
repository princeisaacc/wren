"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function InstallButton() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
    } else {
      setHelp(true);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={install}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Install
      </button>
      {help && (
        <p className="max-w-56 text-right text-xs text-sub">
          On iPhone, tap Share in Safari, then Add to Home Screen. On other browsers, use the install option in the browser menu.
        </p>
      )}
    </div>
  );
}
