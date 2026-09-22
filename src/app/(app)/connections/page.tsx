"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { ServiceIcon } from "@/components/service-icon";
import { useConnections } from "@/components/connections-context";
import { useToast } from "@/components/toast";
import { serviceOrder, services, type ServiceKey } from "@/lib/services";

export default function ConnectionsPage() {
  const { connected, ready, requestConnect, disconnect } = useConnections();
  const toast = useToast();
  const [managing, setManaging] = useState<ServiceKey | null>(null);
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setManaging(null);
    setConfirming(false);
  };

  const service = managing ? services[managing] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-sub">Wren only uses the services you connect here. You can disconnect at any time.</p>
      </header>

      <ul className="space-y-3">
        {serviceOrder.map((key) => {
          const s = services[key];
          const on = connected[key];
          return (
            <li key={key} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-soft text-brand">
                  <ServiceIcon service={key} />
                </span>
                <div>
                  <h2 className="text-base font-semibold">{s.name}</h2>
                  <p className="mt-0.5 text-sm text-sub">{s.blurb}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
                {on ? (
                  <span className="flex items-center gap-1.5 text-sm text-brand-dark">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Connected
                  </span>
                ) : (
                  <span className="text-sm text-sub">{ready ? "Not connected" : "Checking..."}</span>
                )}
                {on ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setManaging(key)}>Manage</button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => requestConnect(key)}>Connect</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!service} onClose={close} title={service ? `Manage ${service.name}` : "Manage"}>
        {service && managing && !confirming && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-soft text-brand">
                <ServiceIcon service={managing} />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{service.name}</h2>
                <p className="text-sm text-sub">Connected</p>
              </div>
            </div>
            <div className="mb-5 rounded-lg bg-soft p-4">
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
            <div className="flex flex-col gap-2">
              <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Disconnect {service.name}</button>
              <button type="button" className="btn btn-secondary" onClick={close}>Close</button>
            </div>
          </div>
        )}
        {service && managing && confirming && (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Disconnect {service.name}?</h2>
            <p className="mt-1 text-sm text-sub">Wren will stop using {service.name}. You can connect it again whenever you want.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const ok = await disconnect(managing);
                  toast.show(ok ? `${service.name} disconnected.` : "Could not disconnect. Try again.");
                  close();
                }}
              >
                Disconnect
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}