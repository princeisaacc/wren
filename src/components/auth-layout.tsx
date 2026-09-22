import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { brand } from "@/lib/brand";

export function AuthLayout({
  title,
  subtitle,
  children,
  back = "/",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-4">
        <Link href={back} aria-label="Back" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-softer">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Logo />
        <span className="w-9" aria-hidden="true" />
      </header>
      <main className="flex-1 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-sub">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
      <footer className="flex flex-col items-center gap-2 pt-6 text-xs text-sub">
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
