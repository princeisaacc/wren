import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

// Draft text that matches how the product is designed. Have it reviewed before launch,
// and name the actual service providers once they are final.
export default function PrivacyPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
        <p className="mt-1 text-sub">Last updated 19 September 2026</p>
      </header>
      <p>
        {brand.name} is a personal assistant. You ask in plain language, and {brand.name} works with the Google services you choose to connect. This page explains what we keep and what we do not.
      </p>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name and email address, to run your account.</li>
          <li>Your conversations with {brand.name}, so you can find them again in History.</li>
          <li>Which services you connected and when, but never your Google password.</li>
          <li>A record of actions {brand.name} took for you (for example, that an event was added), so problems can be investigated. By default this record does not include the full content of your email or files.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Connected Google services</h2>
        <p>
          You decide which services to connect: Calendar, Tasks, Gmail and Drive. {brand.name} only reads or changes them when you ask, and asks for your confirmation before actions that change data or reach other people. Your connection is used only for your own account and is never shared with other users.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Who else handles your data</h2>
        <p>
          To do its job, {brand.name} uses Google, an integration provider that manages the connections to your Google account, and an AI model provider that reads your messages and the results of your requests in order to reply. We share only what is needed for each request.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">How to disconnect</h2>
        <p>
          Open Connections, choose Manage on a service, and select Disconnect. You can also remove {brand.name}&apos;s access at any time from your Google Account security settings.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Deleting your data</h2>
        <p>
          You can delete individual conversations in History. You can delete your whole account in Settings, which removes your account, conversations and saved connections. To ask us for anything else, write to {brand.supportEmail}.
        </p>
      </section>
    </article>
  );
}
