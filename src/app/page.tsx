import Link from "next/link";
import { CalendarDays, ListChecks, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { GoogleButton } from "@/components/google-button";
import { brand } from "@/lib/brand";

const examples = [
  { icon: CalendarDays, source: "Google Calendar", text: "What do I have going on this Friday afternoon?" },
  { icon: ListChecks, source: "Google Tasks", text: "Remind me to submit the biochemistry lab report tomorrow at 9:00 AM." },
  { icon: Mail, source: "Gmail and Drive", text: "Find the slide deck Professor Okafor sent last Tuesday." },
];

export default function WelcomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-4">
        <Logo />
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-brand hover:underline">
          Log in
        </Link>
      </header>

      <main className="flex-1 py-6">
        <h1 className="text-[1.625rem] font-semibold leading-8 tracking-tight">
          Tell {brand.name} what you need. It handles Calendar, Tasks, Gmail and Drive.
        </h1>
        <p className="mt-3 text-base text-sub">
          Ask in plain language. Connect only the Google services you choose, and {brand.name} does the routine work for you.
        </p>

        <section aria-label="Examples" className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-sub">Things you can ask</h2>
          <ul className="space-y-2">
            {examples.map(({ icon: Icon, source, text }) => (
              <li key={source} className="card flex gap-3 p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <p className="text-xs text-sub">{source}</p>
                  <p className="text-sm font-medium">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 flex flex-col gap-2">
          <Link href="/signup" className="btn btn-primary">Create account</Link>
          <GoogleButton />
        </div>
        <p className="mt-4 text-center text-xs text-sub">
          {brand.name} only connects to the services you choose.
        </p>
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
