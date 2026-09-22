import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms and Conditions" };

// Draft text. Have it reviewed before launch.
export default function TermsPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Terms and Conditions</h1>
        <p className="mt-1 text-sub">Last updated 19 September 2026</p>
      </header>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">The service</h2>
        <p>
          {brand.name} is an assistant that helps you work with your Google Calendar, Tasks, Gmail and Drive using plain language. It only uses the services you connect.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Your account</h2>
        <p>
          You are responsible for your account and for keeping your login details safe. Give us accurate information, and do not use {brand.name} to break the law or to access accounts that are not yours.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Actions and confirmation</h2>
        <p>
          {brand.name} asks you to confirm before it deletes, sends or shares anything. Assistants can misunderstand a request, so check the details in each confirmation before you approve it.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Ending your use</h2>
        <p>
          You can disconnect any service or delete your account at any time. We may suspend accounts that misuse the service or put other users at risk.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Questions</h2>
        <p>Write to {brand.supportEmail}.</p>
      </section>
    </article>
  );
}
