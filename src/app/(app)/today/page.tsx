"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ListChecks, Mail, MapPin, RefreshCw } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { useAuth, useProfile } from "@/components/auth-context";
import { useConnections } from "@/components/connections-context";
import type { TodayData, TodayEmail, TodayEvent } from "@/lib/today";
import { services, type ServiceKey } from "@/lib/services";

type Detail = { kind: "event"; item: TodayEvent } | { kind: "email"; item: TodayEmail } | null;

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function eventTime(e: TodayEvent) {
  if (e.allDay) return "All day";
  return e.end && e.end.includes("T") ? `${timeOf(e.start)} to ${timeOf(e.end)}` : timeOf(e.start);
}

function NotConnected({ service }: { service: ServiceKey }) {
  const { requestConnect } = useConnections();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-soft p-4">
      <p className="text-sm text-muted">Connect {services[service].name} to see this here.</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => requestConnect(service)}>
        Connect
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      <div className="h-16 animate-pulse rounded-lg bg-softer" />
      <div className="h-16 animate-pulse rounded-lg bg-softer" />
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-soft p-4 text-sm text-danger-ink">
      <span>{message}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export default function TodayPage() {
  const { user } = useAuth();
  const { name } = useProfile();
  const { connected: sharedConnected } = useConnections();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFailed(false);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/today?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}&today=${day}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as TodayData);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Loads on open, and again when a service is connected or disconnected.
  useEffect(() => {
    load();
  }, [load, sharedConnected]);

  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const connected = data?.connected;

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 md:px-8 md:py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" suppressHydrationWarning>{date}</h1>
          <p className="mt-1 text-sm text-sub" suppressHydrationWarning>{greeting}, {name.split(" ")[0]}. Here is your day.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {failed ? (
        <Failed message="Could not load your day. Check your connection." onRetry={load} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <section className="card p-4 md:p-5" aria-labelledby="schedule-h">
              <h2 id="schedule-h" className="mb-3 flex items-center gap-2 text-base font-semibold">
                <CalendarDays className="h-5 w-5 text-brand" strokeWidth={1.75} aria-hidden="true" />
                Schedule
              </h2>
              {!data ? (
                <Skeleton />
              ) : !connected?.calendar ? (
                <NotConnected service="calendar" />
              ) : data.errors.calendar ? (
                <Failed message={data.errors.calendar} onRetry={load} />
              ) : data.events.length === 0 ? (
                <p className="text-sm text-sub">Nothing scheduled today.</p>
              ) : (
                <ul className="space-y-2">
                  {data.events.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => setDetail({ kind: "event", item: e })} className="w-full rounded-lg bg-soft p-4 text-left hover:bg-softer">
                        <p className="text-xs font-medium text-brand">{eventTime(e)}</p>
                        <p className="mt-0.5 text-sm font-medium">{e.title}</p>
                        {e.place && (
                          <p className="mt-1 flex items-center gap-1 text-sm text-sub">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {e.place}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-4 md:p-5" aria-labelledby="tasks-h">
              <h2 id="tasks-h" className="mb-3 flex items-center gap-2 text-base font-semibold">
                <ListChecks className="h-5 w-5 text-brand" strokeWidth={1.75} aria-hidden="true" />
                Tasks due today
              </h2>
              {!data ? (
                <Skeleton />
              ) : !connected?.tasks ? (
                <NotConnected service="tasks" />
              ) : data.errors.tasks ? (
                <Failed message={data.errors.tasks} onRetry={load} />
              ) : data.tasks.length === 0 ? (
                <p className="text-sm text-sub">No tasks due today.</p>
              ) : (
                <ul className="space-y-2">
                  {data.tasks.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg bg-soft p-4">
                      <p className="text-sm font-medium">{t.title}</p>
                      {t.overdue && <span className="shrink-0 rounded bg-danger-soft px-2 py-0.5 text-xs text-danger-ink">Overdue</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card h-fit p-4 md:p-5 lg:col-span-2" aria-labelledby="mail-h">
            <h2 id="mail-h" className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Mail className="h-5 w-5 text-brand" strokeWidth={1.75} aria-hidden="true" />
              Emails to look at
            </h2>
            {!data ? (
              <Skeleton />
            ) : !connected?.gmail ? (
              <NotConnected service="gmail" />
            ) : data.errors.gmail ? (
              <Failed message={data.errors.gmail} onRetry={load} />
            ) : data.emails.length === 0 ? (
              <p className="text-sm text-sub">No new emails from the last 3 days.</p>
            ) : (
              <ul className="space-y-2">
                {data.emails.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setDetail({ kind: "email", item: m })} className="w-full rounded-lg bg-soft p-4 text-left hover:bg-softer">
                      <div className="flex justify-between gap-2 text-xs text-sub">
                        <span className="truncate font-medium text-ink">{m.from}</span>
                        {m.time && Number.isFinite(Date.parse(m.time)) && <span className="shrink-0">{timeOf(m.time)}</span>}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">{m.subject}</p>
                      {m.snippet && <p className="mt-0.5 line-clamp-2 text-sm text-sub">{m.snippet}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title="Details">
        {detail?.kind === "event" && (
          <div>
            <p className="text-xs font-medium text-brand">{eventTime(detail.item)}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{detail.item.title}</h2>
            {detail.item.place && (
              <p className="mt-2 flex items-center gap-1 text-sm text-sub">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {detail.item.place}
              </p>
            )}
            <a href={detail.item.link || "https://calendar.google.com/"} target="_blank" rel="noreferrer" className="btn btn-secondary mt-5 w-full">
              {services.calendar.openLabel}
            </a>
          </div>
        )}
        {detail?.kind === "email" && (
          <div>
            <p className="text-xs text-sub">{detail.item.from}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{detail.item.subject}</h2>
            {detail.item.snippet && <p className="mt-2 text-sm text-muted">{detail.item.snippet}</p>}
            <a href={detail.item.link} target="_blank" rel="noreferrer" className="btn btn-secondary mt-5 w-full">
              {services.gmail.openLabel}
            </a>
          </div>
        )}
      </Sheet>
    </div>
  );
}