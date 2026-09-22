"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Link2, MessageSquare, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import { OfflineBanner } from "@/components/offline-banner";
import { useProfile } from "@/components/auth-context";

const nav = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Avatar({ size = "h-8 w-8" }: { size?: string }) {
  const { initials } = useProfile();
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-onbrand`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, email } = useProfile();
  const isActive = (href: string) => pathname === href || (href === "/chat" && pathname === "/history");

  return (
    <div className="min-h-dvh">
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-card px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Logo />
        <Avatar />
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between border-r border-line bg-card md:flex">
        <div className="p-4">
          <div className="mb-8">
            <Logo />
          </div>
          <nav aria-label="Main" className="flex flex-col gap-1">
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

      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] md:pb-0 md:pl-60 md:pt-0">
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
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs ${
              isActive(href) ? "font-medium text-brand-dark" : "text-sub"
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