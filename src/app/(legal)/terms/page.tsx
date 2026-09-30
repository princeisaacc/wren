import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms and Conditions" };

export default function TermsPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Terms and Conditions</h1>
        <p className="mt-1 text-sub">Last updated 29 September 2026</p>
      </header>

      <p>
        These terms cover your use of {brand.name}. By creating an account or using {brand.name}, you agree to them. If you
        don&apos;t agree, please don&apos;t use the service.
      </p>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">The service</h2>
        <p>
          {brand.name} is an assistant that helps you work with your Google Calendar, Tasks, Gmail and Drive using plain
          language. It only uses the services you choose to connect, and is currently offered as a beta for testing — it may
          change, break, or be unavailable at times without notice.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Who can use it</h2>
        <p>
          You must be old enough to hold and manage your own Google Account under Google&apos;s own policies. You need a
          Google Account to use most of {brand.name}&apos;s features.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Your account</h2>
        <p>
          You are responsible for your account and for keeping your login details safe. Give us accurate information, tell us
          if you suspect unauthorized use of your account, and do not use {brand.name} to break the law or to access accounts
          or data that are not yours.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">AI can make mistakes</h2>
        <p>
          {brand.name} uses AI models to understand your requests and write its replies. AI can misread a request,
          misunderstand context, or occasionally state something confidently that isn&apos;t accurate. {brand.name} asks you
          to confirm before it adds, changes, deletes, sends or shares anything — read what a confirmation says before you
          approve it, and don&apos;t rely on {brand.name}&apos;s replies as your only check for anything important, time-sensitive,
          medical, legal, or financial.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Use {brand.name} for anything illegal, harmful, or that violates someone else&apos;s rights.</li>
          <li>Try to disrupt, overload, reverse-engineer, or gain unauthorized access to {brand.name} or its systems.</li>
          <li>Use {brand.name} to send spam, harassment, or unsolicited messages through your connected accounts.</li>
          <li>Resell or provide {brand.name} to others as if it were your own service.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Usage limits</h2>
        <p>
          Because {brand.name} is in beta, your account has a daily and per-conversation limit on AI usage, shown in Settings.
          These limits may change as the service develops.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">&quot;As is&quot;, and the limits of our responsibility</h2>
        <p>
          {brand.name} is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, express or
          implied, including any warranty that it will be uninterrupted, error-free, or fit for a particular purpose. To the
          fullest extent the law allows, {brand.name} and its developer are not liable for indirect, incidental, or
          consequential damages arising from your use of the service, including any action {brand.name} takes on a connected
          service at your request or with your confirmation. Nothing here limits liability that cannot legally be limited.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Ending your use</h2>
        <p>
          You can disconnect any service or delete your account at any time in Settings. We may suspend or end an account
          that breaks these terms, misuses the service, or puts other users or the service itself at risk, with notice where
          reasonably possible.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Changes to these terms</h2>
        <p>
          We may update these terms as {brand.name} develops. We&apos;ll change the date at the top when we do. Continued use
          after a change means you accept the update.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Governing law</h2>
        <p>
          These terms are governed by the laws of Nigeria, without regard to its conflict-of-law rules. If you&apos;re
          located elsewhere, local consumer-protection laws that can&apos;t be waived by contract still apply to you.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Questions</h2>
        <p>Write to {brand.supportEmail}.</p>
      </section>
    </article>
  );
}