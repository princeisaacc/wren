import Link from "next/link";
import { Logo } from "@/components/logo";
import { brand } from "@/lib/brand";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-4">
        <Link href="/" aria-label={`${brand.name} home`}><Logo /></Link>
        <Link href="/chat" className="text-sm font-medium text-brand hover:underline">Open app</Link>
      </header>
      <main className="py-6">{children}</main>
      <footer className="flex flex-col gap-2 border-t border-line pt-6 text-xs text-sub">
        <nav aria-label="Legal" className="flex gap-4">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/contact" className="hover:text-ink">Contact</Link>
        </nav>
        <span>© {brand.year} {brand.name}</span>
      </footer>
    </div>
  );
}
