"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, History as HistoryIcon, Link2, MessageSquare, MoreHorizontal, Pin, PinOff, Plus, Settings, Trash2, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { OfflineBanner } from "@/components/offline-banner";
import { useAuth, useProfile } from "@/components/auth-context";
import { useToast } from "@/components/toast";
import {
  deleteConversation,
  renameConversation,
  setConversationPinned,
  subscribeConversations,
  type Conversation,
} from "@/lib/chat-store";

const nav = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

// How many recent (unpinned) conversations show in the sidebar before "History" takes over.
const RECENT_LIMIT = 8;

function Avatar({ size = "h-8 w-8" }: { size?: string }) {
  const { initials } = useProfile();
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-onbrand`} aria-hidden="true">
      {initials}
    </span>
  );
}

function ConversationRow({ c, active }: { c: Conversation; active: boolean }) {
  const { user } = useAuth();
  const { show } = useToast();
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
    if (!user) return;
    setMenuOpen(false);
    try {
      await setConversationPinned(user.uid, c.id, !c.pinned);
    } catch {
      show("Could not update that. Try again.");
    }
  };

  const saveRename = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await renameConversation(user.uid, c.id, draftTitle);
      setRenaming(false);
    } catch {
      show("Could not rename that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user) return;
    setMenuOpen(false);
    try {
      await deleteConversation(user.uid, c.id);
      show("Conversation deleted.");
    } catch {
      show("Could not delete that. Try again.");
    }
  };

  if (renaming) {
    return (
      <li className="flex items-center gap-1 rounded-lg px-2 py-1">
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          className="input h-8 flex-1 px-2 text-sm"
          aria-label="Conversation name"
        />
        <button type="button" onClick={saveRename} disabled={busy} aria-label="Save name" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-softer">
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setRenaming(false)} aria-label="Cancel" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-softer">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </li>
    );
  }

  return (
    <li className="group relative">
      <Link
        href={`/chat?c=${c.id}`}
        className={`flex items-center gap-2 rounded-lg py-2 pl-3 pr-8 text-sm transition-colors ${
          active ? "bg-tint font-medium text-brand-dark" : "text-muted hover:bg-softer hover:text-ink"
        }`}
      >
        {c.pinned && <Pin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
        <span className="truncate">{c.title || "New chat"}</span>
      </Link>
      <button
        type="button"
        aria-label={`Options for ${c.title}`}
        onClick={() => setMenuOpen((v) => !v)}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-sub opacity-0 hover:bg-softer group-hover:opacity-100 focus:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {menuOpen && (
        <div ref={menuRef} className="absolute right-0 top-8 z-40 w-40 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-lg">
          <button type="button" onClick={togglePin} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-softer">
            {c.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
            {c.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            onClick={() => { setDraftTitle(c.title); setRenaming(true); setMenuOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-softer"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Rename
          </button>
          <button type="button" onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

function RecentChats({ currentCid }: { currentCid: string | null }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Conversation[] | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeConversations(user.uid, setItems, () => setItems([]));
  }, [user]);

  if (!items || !items.length) return null;

  const pinned = items.filter((c) => c.pinned);
  const recent = items.filter((c) => !c.pinned).slice(0, RECENT_LIMIT);

  return (
    <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
      {pinned.length > 0 && (
        <div className="mb-3">
          <h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-sub">Pinned</h2>
          <ul className="space-y-0.5">
            {pinned.map((c) => <ConversationRow key={c.id} c={c} active={c.id === currentCid} />)}
          </ul>
        </div>
      )}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-sub">Recent</h2>
          <ul className="space-y-0.5">
            {recent.map((c) => <ConversationRow key={c.id} c={c} active={c.id === currentCid} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { name, email } = useProfile();
  const currentCid = pathname === "/chat" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("c") : null;
  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-dvh">
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-card px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Logo />
        <Avatar />
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card md:flex">
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-4">
            <Logo />
          </div>

          <button
            type="button"
            onClick={() => router.push("/chat")}
            className="btn btn-primary btn-sm w-full justify-center"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New chat
          </button>

          <RecentChats currentCid={currentCid} />

          <nav aria-label="Main" className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
            <Link
              href="/history"
              aria-current={isActive("/history") ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive("/history") ? "bg-tint font-medium text-brand-dark" : "text-muted hover:bg-softer hover:text-ink"
              }`}
            >
              <HistoryIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              History
            </Link>
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(href) ? "bg-tint font-medium text-brand-dark" : "text-muted hover:bg-softer hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 border-t border-line p-4">
          <Avatar />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-sub">{email}</p>
          </div>
        </div>
      </aside>

      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] md:pb-0 md:pl-64 md:pt-0">
        <OfflineBanner />
        <main>{children}</main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href || (href === "/chat" && pathname === "/history") ? "page" : undefined}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs ${
              pathname === href || (href === "/chat" && pathname === "/history") ? "font-medium text-brand-dark" : "text-sub"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}