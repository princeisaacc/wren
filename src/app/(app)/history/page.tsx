"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { useAuth } from "@/components/auth-context";
import { useToast } from "@/components/toast";
import { deleteConversation, subscribeConversations, type Conversation } from "@/lib/chat-store";

const groups = ["Today", "Yesterday", "Earlier this week", "Older"] as const;

function groupOf(ts: number): (typeof groups)[number] {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  if (ts >= startToday) return "Today";
  if (ts >= startToday - day) return "Yesterday";
  if (ts >= startToday - 6 * day) return "Earlier this week";
  return "Older";
}

function when(ts: number) {
  const g = groupOf(ts);
  return g === "Today" || g === "Yesterday"
    ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const uid = user?.uid;
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeConversations(uid, setItems, () => {
      setItems([]);
      show("Could not load your history.");
    });
  }, [uid, show]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items ?? [];
    return q ? list.filter((c) => (c.title + " " + c.preview).toLowerCase().includes(q)) : list;
  }, [items, query]);

  const remove = async () => {
    if (!uid || !toDelete) return;
    setDeleting(true);
    try {
      await deleteConversation(uid, toDelete.id);
      setToDelete(null);
      show("Conversation deleted.");
    } catch {
      show("Could not delete the conversation. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 md:px-8 md:py-8">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/chat" aria-label="Back to chat" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-softer">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-sub" aria-hidden="true" />
        <label htmlFor="history-search" className="sr-only">Search conversations</label>
        <input id="history-search" className="input pl-9" placeholder="Search conversations" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {items === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading">
          <div className="h-20 animate-pulse rounded-xl bg-softer" />
          <div className="h-20 animate-pulse rounded-xl bg-softer" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-sub">
          {items.length === 0 ? "No conversations yet." : "No conversations match your search."}
        </p>
      ) : (
        groups.map((g) => {
          const list = filtered.filter((c) => groupOf(c.updatedAt) === g);
          if (!list.length) return null;
          return (
            <section key={g} className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-sub">{g}</h2>
              <ul className="space-y-2">
                {list.map((c) => (
                  <li key={c.id} className="card flex items-start gap-2 p-4">
                    <Link href={`/chat?c=${c.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-sub">{c.preview}</p>
                      <p className="mt-2 text-xs text-sub">{when(c.updatedAt)}</p>
                    </Link>
                    <button type="button" aria-label={`Delete ${c.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sub hover:bg-danger-soft hover:text-danger" onClick={() => setToDelete(c)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <p className="pb-4 text-xs text-sub">Conversations are saved to your Wren account. You can delete them anytime.</p>

      <Sheet open={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Delete conversation">
        {toDelete && (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Delete this conversation?</h2>
            <p className="mt-1 text-sm text-sub">“{toDelete.title}” will be removed from your history. This cannot be undone.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" className="btn btn-danger" onClick={remove} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}