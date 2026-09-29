"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, MoreHorizontal, Pin, PinOff, Search, Trash2, X } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { useAuth } from "@/components/auth-context";
import { useToast } from "@/components/toast";
import { deleteConversation, renameConversation, setConversationPinned, subscribeConversations, type Conversation } from "@/lib/chat-store";

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

function HistoryRow({ c, uid, show, onDelete }: { c: Conversation; uid: string; show: (t: string) => void; onDelete: (c: Conversation) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(c.title);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const togglePin = async () => {
    setMenuOpen(false);
    try {
      await setConversationPinned(uid, c.id, !c.pinned);
    } catch {
      show("Could not update that. Try again.");
    }
  };

  const saveRename = async () => {
    setBusy(true);
    try {
      await renameConversation(uid, c.id, draftTitle);
      setRenaming(false);
    } catch {
      show("Could not rename that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (renaming) {
    return (
      <li className="card flex items-center gap-2 p-3">
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(false); }}
          className="input h-9 flex-1 text-sm"
          aria-label="Conversation name"
        />
        <button type="button" onClick={saveRename} disabled={busy} aria-label="Save name" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-softer">
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setRenaming(false)} aria-label="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-softer">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </li>
    );
  }

  return (
    <li className="card relative flex items-start gap-2 p-4">
      <Link href={`/chat?c=${c.id}`} className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {c.pinned && <Pin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
          {c.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-sub">{c.preview}</p>
        <p className="mt-2 text-xs text-sub">{when(c.updatedAt)}</p>
      </Link>
      <button type="button" aria-label={`Options for ${c.title}`} onClick={() => setMenuOpen((v) => !v)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sub hover:bg-softer">
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {menuOpen && (
        <div ref={menuRef} className="absolute right-2 top-12 z-40 w-40 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-lg">
          <button type="button" onClick={togglePin} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-softer">
            {c.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
            {c.pinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" onClick={() => { setDraftTitle(c.title); setRenaming(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-softer">
            <Check className="h-4 w-4" aria-hidden="true" />
            Rename
          </button>
          <button type="button" onClick={() => { setMenuOpen(false); onDelete(c); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </li>
  );
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
        <>
          {(() => {
            const pinnedList = filtered.filter((c) => c.pinned);
            if (!pinnedList.length) return null;
            return (
              <section className="mb-6">
                <h2 className="mb-2 text-sm font-medium text-sub">Pinned</h2>
                <ul className="space-y-2">
                  {pinnedList.map((c) => (
                    <HistoryRow key={c.id} c={c} uid={uid!} show={show} onDelete={setToDelete} />
                  ))}
                </ul>
              </section>
            );
          })()}
          {groups.map((g) => {
            const list = filtered.filter((c) => !c.pinned && groupOf(c.updatedAt) === g);
            if (!list.length) return null;
            return (
              <section key={g} className="mb-6">
                <h2 className="mb-2 text-sm font-medium text-sub">{g}</h2>
                <ul className="space-y-2">
                  {list.map((c) => (
                    <HistoryRow key={c.id} c={c} uid={uid!} show={show} onDelete={setToDelete} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
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
              <button type="button" className="btn btn-secondar y" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}