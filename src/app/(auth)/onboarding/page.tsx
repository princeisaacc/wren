"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { ServiceIcon } from "@/components/service-icon";
import { useConnections } from "@/components/connections-context";
import { serviceOrder, services } from "@/lib/services";

export default function OnboardingPage() {
  const { connected, requestConnect } = useConnections();

  return (
    <AuthLayout
      title="Connect what you want Wren to use"
      subtitle="Every connection is optional. Wren only reads what you ask it to, and you can disconnect anytime in Connections."
      back="/signup"
    >
      <ul className="space-y-2">
        {serviceOrder.map((key) => {
          const s = services[key];
          return (
            <li key={key} className="card flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-soft text-brand">
                <ServiceIcon service={key} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-sub">{s.blurb}</p>
              </div>
              {connected[key] ? (
                <span className="flex items-center gap-1 text-sm font-medium text-brand">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Connected
                </span>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => requestConnect(key)}>
                  Connect
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-col gap-2">
        <Link href="/chat" className="btn btn-primary">Continue to Wren</Link>
        <Link href="/chat" className="btn text-sub hover:bg-softer">Skip for now</Link>
      </div>
    </AuthLayout>
  );
}
