import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

// Matches how the product is actually built as of this writing. If you change what data
// Wren touches, who processes it, or how deletion works, update this page in the same change.
export default function PrivacyPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
        <p className="mt-1 text-sub">Last updated 29 September 2026</p>
      </header>

      <p>
        {brand.name} is a personal assistant. You ask in plain language, and {brand.name} works with the Google services you
        choose to connect — Calendar, Tasks, Gmail and Drive. This page explains what we collect, who else sees it, and how
        you can remove it.
      </p>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name and email address, to create and run your account.</li>
          <li>Your conversations with {brand.name} — the messages you send and the replies you get — so you can find them again in History.</li>
          <li>Which Google services you&apos;ve connected, and when, but never your Google password. We never see or store your password; Google handles sign-in directly.</li>
          <li>Facts {brand.name} learns about you from chatting (for example, your timezone or a recurring preference), shown to you in Settings under Memory, which you can review or delete at any time.</li>
          <li>Your chosen settings — timezone, default reminder time, personality, and whether {brand.name} should ask before making changes.</li>
          <li>How many tokens (a unit of AI usage) your account has used each day and in each conversation, so we can keep the service available and fair to everyone testing it. This is a count, not the content of your messages.</li>
          <li>A record that an action was taken (for example, that a calendar event was added), so problems can be investigated. By default this record does not store the full content of your emails or files.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Connected Google services</h2>
        <p>
          You decide which services to connect. {brand.name} only reads or changes them when you ask, and asks for your
          confirmation before anything that changes your data or reaches other people, such as sending or deleting something.
          Your connection is used only for your own account and is never shared with, or visible to, other users.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Google API Services Usage Disclosure</h2>
        <p>
          {brand.name}&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. In practice this means: we only use your Google data to provide the
          features you see in {brand.name} itself, we do not use it to serve ads, we do not sell it, and we do not use it to
          train general-purpose AI models. No one at {brand.name} reads the content of your emails, calendar or files except
          where necessary to investigate a specific problem you&apos;ve reported, or where required by law.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Who else handles your data, and why</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Google</strong> — provides your login, and the Calendar, Tasks, Gmail and Drive data you&apos;ve connected.</li>
          <li><strong>Composio</strong> — the integration layer that carries out actions on your connected Google services on {brand.name}&apos;s behalf. It does not use your data for anything beyond executing the request you made.</li>
          <li>
            <strong>Groq and Google Gemini</strong> — the AI providers that read your message and any connected data needed to
            answer it, in order to generate {brand.name}&apos;s reply. This happens for every request; it is how the assistant
            works. Groq does not use this data to train any model, on any plan. {brand.name} currently uses Google Gemini&apos;s
            free API tier, under which Google states it may use submitted prompts and data to improve its own products. If
            this matters to you, avoid sharing anything especially sensitive through {brand.name} for now — we plan to move
            to Google&apos;s paid tier, which does not carry this condition, and will update this page when we do.
          </li>
          <li><strong>Firebase (Google Cloud)</strong> — stores your account, conversations, settings and memory, and handles login.</li>
        </ul>
        <p className="mt-2">
          None of these providers are permitted to use your data for advertising, and we share only what a specific request
          needs — never your full account or unrelated conversations.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Where your data is processed</h2>
        <p>
          {brand.name} and the providers above operate on infrastructure that may be located outside your own country. By
          using {brand.name}, you agree to your information being processed in this way.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">How to disconnect a service</h2>
        <p>
          Open Connections, choose Manage on a service, and select Disconnect. You can also remove {brand.name}&apos;s access
          at any time from your Google Account&apos;s own security settings, independently of {brand.name}.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Deleting your data</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Delete a single conversation any time from History.</li>
          <li><strong>Clear my data</strong> in Settings deletes every conversation and message, and keeps your account, connections and settings as they are.</li>
          <li><strong>Delete account</strong> in Settings removes your account, conversations, memory and saved connections entirely.</li>
        </ul>
        <p className="mt-2">To ask us to delete anything this doesn&apos;t cover, write to {brand.supportEmail}.</p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Children</h2>
        <p>
          {brand.name} is not directed at children. You must be old enough to manage your own Google Account under
          Google&apos;s own policies to use {brand.name}, since it works through your Google Account.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Changes to this policy</h2>
        <p>
          If we change how {brand.name} uses your data, we&apos;ll update this page and change the date at the top. Continued
          use of {brand.name} after a change means you accept the update.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Contact</h2>
        <p>Questions about this policy or your data: {brand.supportEmail}.</p>
      </section>
    </article>
  );
}