"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { Check, X } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { ServiceIcon } from "@/components/service-icon";
import { useToast } from "@/components/toast";
import { useAuth } from "@/components/auth-context";
import { useLoading } from "@/components/loading";
import { services, type ServiceKey } from "@/lib/services";

type Connected = Record<ServiceKey, boolean>;

const none: Connected = { calendar: false, tasks: false, gmail: false, drive: false };

type ConnectionsValue = {
  connected: Connected;
  ready: boolean;
  requestConnect: (key: ServiceKey) => void;
  disconnect: (key: ServiceKey) => Promise<boolean>;
};

const ConnectionsContext = createContext<ConnectionsValue | null>(null);

export function useConnections() {
  const value = useContext(ConnectionsContext);
  if (!value) throw new Error("useConnections must be used inside ConnectionsProvider");
  return value;
}

async function api(user: User, path: string, body?: unknown) {
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
  const { show } = useToast();
  const { user } = useAuth();
  const overlay = useLoading();
  const [connected, setConnected] = useState<Connected>(none);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<ServiceKey | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api(user, "/api/connections");
      setConnected({ ...none, ...data.connected });
    } catch {
      show("Could not check your connections.");
    } finally {
      setReady(true);
    }
  }, [user, show]);

  useEffect(() => {
    if (!user) {
      setConnected(none);
      setReady(false);
      return;
    }
    refresh();
  }, [user, refresh]);

  // When Google sends the user back, Composio adds ?status=success or ?status=failed to the address.
  useEffect(() => {
    if (!user) return;
    const status = new URLSearchParams(window.location.search).get("status");
    if (status !== "success" && status !== "failed") return;
    show(status === "success" ? "Connected." : "Could not connect. You can try again.");
    window.history.replaceState(null, "", window.location.pathname);
    refresh();
  }, [user, refresh, show]);

  const requestConnect = useCallback((key: ServiceKey) => setPending(key), []);

  const disconnect = useCallback(
    async (key: ServiceKey) => {
      if (!user) return false;
      try {
        await overlay.run("Disconnecting...", () => api(user, "/api/connections/disconnect", { service: key }));
        setConnected((c) => ({ ...c, [key]: false }));
        return true;
      } catch {
        return false;
      }
    },
    [user],
  );

  const service = pending ? services[pending] : null;

  const close = () => {
    if (!loading) setPending(null);
  };

  const proceed = async () => {
    if (!pending || !user) return;
    setLoading(true);
    overlay.show("Opening Google...");
    try {
      const data = await api(user, "/api/connections/connect", { service: pending, returnTo: window.location.pathname });
      window.location.href = data.url;
    } catch {
      overlay.hide();
      setLoading(false);
      show("Could not start the connection. Try again.");
    }
  };

  return (
    <ConnectionsContext.Provider value={{ connected, ready, requestConnect, disconnect }}>
      {children}
      <Sheet open={!!service} onClose={close} title={service ? `Connect ${service.name}` : "Connect"}>
        {service && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-soft text-brand">
                <ServiceIcon service={service.key} />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Connect {service.name}</h2>
                <p className="text-sm text-sub">You choose what Wren can use. You can disconnect at any time.</p>
              </div>
            </div>

            <div className="mb-3 rounded-lg bg-soft p-4">
              <h3 className="mb-2 text-sm font-medium">What Wren can do</h3>
              <ul className="space-y-2">
                {service.can.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-5 rounded-lg bg-soft p-4">
              <h3 className="mb-2 text-sm font-medium">What Wren will not do</h3>
              <ul className="space-y-2">
                {service.cannot.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-muted">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <button type="button" className="btn btn-primary" onClick={proceed} disabled={loading}>
                {loading ? "Opening Google..." : "Continue to Google"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={close} disabled={loading}>
                Not now
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </ConnectionsContext.Provider>
  );
}