"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Monitor, Moon, Sun } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { InstallButton } from "@/components/install-button";
import { Field } from "@/components/field";
import { useToast } from "@/components/toast";
import { useLoading } from "@/components/loading";
import { authMessage, useAuth, useProfile } from "@/components/auth-context";
import { useTheme, type Theme } from "@/components/theme";

function Toggle({ label, checked, onChange, locked }: { label: string; checked: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={locked}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${checked ? "bg-brand" : "bg-sub"} ${locked ? "opacity-70" : ""}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

type Dialog = null | "profile" | "logout" | "delete";

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const auth = useAuth();
  const overlay = useLoading();
  const { theme, setTheme } = useTheme();
  const { name, email, initials } = useProfile();
  const [draftName, setDraftName] = useState(name);
  const [askBeforeChanges, setAskBeforeChanges] = useState(true);
  const [confirmText, setConfirmText] = useState("");

  const closeDialog = () => {
    setDialog(null);
    setConfirmText("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 md:px-8 md:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-4" aria-label="Profile">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-sm font-medium text-onbrand" aria-hidden="true">
            {initials}
          </span>
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-sm text-sub">{email}</p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDraftName(name); setDialog("profile"); }}>
          Edit profile
        </button>
      </section>

      <section className="card p-4" aria-labelledby="appearance-h">
        <h2 id="appearance-h" className="text-base font-semibold">Appearance</h2>
        <p className="mb-3 text-sm text-sub">Choose how Wren looks. System follows your phone or computer.</p>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors ${
                theme === value ? "border-brand bg-tint text-brand-dark" : "border-line bg-card text-ink hover:bg-softer"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4" aria-labelledby="confirm-h">
        <h2 id="confirm-h" className="text-base font-semibold">Confirmations</h2>
        <p className="mb-2 text-sm text-sub">Wren asks before it does anything that changes your data or reaches other people.</p>
        <ul className="divide-y divide-line/60">
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">Ask before sending email <Lock className="h-3.5 w-3.5 text-sub" aria-label="Always on" /></p>
              <p className="text-sm text-sub">Always on.</p>
            </div>
            <Toggle label="Ask before sending email" checked locked />
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">Ask before deleting events <Lock className="h-3.5 w-3.5 text-sub" aria-label="Always on" /></p>
              <p className="text-sm text-sub">Always on.</p>
            </div>
            <Toggle label="Ask before deleting events" checked locked />
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">Ask before adding or editing events and tasks</p>
              <p className="text-sm text-sub">Turn this off if you want Wren to add them straight away.</p>
            </div>
            <Toggle label="Ask before adding or editing events and tasks" checked={askBeforeChanges} onChange={setAskBeforeChanges} />
          </li>
        </ul>
      </section>

      <section className="card p-4" aria-labelledby="general-h">
        <h2 id="general-h" className="mb-3 text-base font-semibold">General</h2>
        <div className="space-y-4">
          <Field label="Timezone">
            {({ id }) => (
              <select id={id} className="input" defaultValue="Africa/Lagos">
                <option>Africa/Lagos (GMT+1)</option>
                <option>Europe/London</option>
                <option>America/New_York</option>
                <option>Asia/Dubai</option>
              </select>
            )}
          </Field>
          <Field label="Default reminder time" hint="Used when you ask for a reminder without a time.">
            {({ id, describedBy }) => (
              <select id={id} aria-describedby={describedBy} className="input" defaultValue="8:00 AM">
                <option>7:00 AM</option>
                <option>8:00 AM</option>
                <option>9:00 AM</option>
                <option>12:00 PM</option>
              </select>
            )}
          </Field>
        </div>
      </section>

      <section className="card flex items-center justify-between gap-4 p-4" aria-label="Install app">
        <div>
          <h2 className="text-base font-semibold">Install Wren</h2>
          <p className="text-sm text-sub">Add Wren to your home screen and open it like an app.</p>
        </div>
        <InstallButton />
      </section>

      <section className="card p-4" aria-labelledby="account-h">
        <h2 id="account-h" className="mb-3 text-base font-semibold">Account</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn btn-secondary" onClick={() => setDialog("logout")}>Log out</button>
          <button type="button" className="btn btn-secondary text-danger" onClick={() => setDialog("delete")}>Delete account</button>
        </div>
      </section>

      <footer className="flex flex-wrap gap-4 pb-4 text-xs text-sub">
        <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/contact" className="hover:text-ink">Contact</Link>
      </footer>

      <Sheet open={dialog === "profile"} onClose={closeDialog} title="Edit profile">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draftName.trim()) return;
            auth
              .renameUser(draftName.trim())
              .then(() => { closeDialog(); toast.show("Profile updated."); })
              .catch((err) => toast.show(authMessage(err) || "Could not update your profile."));
          }}
        >
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Edit profile</h2>
          <Field label="Full name">
            {({ id }) => <input id={id} className="input" value={draftName} onChange={(e) => setDraftName(e.target.value)} autoComplete="name" />}
          </Field>
          <div className="mt-5 flex flex-col gap-2">
            <button type="submit" className="btn btn-primary">Save changes</button>
            <button type="button" className="btn btn-secondary" onClick={closeDialog}>Cancel</button>
          </div>
        </form>
      </Sheet>

      <Sheet open={dialog === "logout"} onClose={closeDialog} title="Log out">
        <h2 className="text-lg font-semibold tracking-tight">Log out of Wren?</h2>
        <p className="mt-1 text-sm text-sub">Your connections and conversations stay saved.</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await overlay.run("Logging out...", () => auth.logOut());
              router.push("/");
            }}
          >
            Log out
          </button>
          <button type="button" className="btn btn-secondary" onClick={closeDialog}>Cancel</button>
        </div>
      </Sheet>

      <Sheet open={dialog === "delete"} onClose={closeDialog} title="Delete account">
        <h2 className="text-lg font-semibold tracking-tight">Delete your account?</h2>
        <p className="mt-1 text-sm text-sub">
          This removes your Wren account, conversations and saved connections. Your Google data stays in your Google account.
          This cannot be undone.
        </p>
        <div className="mt-4">
          <Field label="Type DELETE to confirm">
            {({ id }) => <input id={id} className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}
          </Field>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-danger"
            disabled={confirmText !== "DELETE"}
            onClick={async () => {
              try {
                await overlay.run("Deleting your account...", () => auth.removeAccount());
                router.push("/");
              } catch (err) {
                toast.show(authMessage(err));
              }
            }}
          >
            Delete account
          </button>
          <button type="button" className="btn btn-secondary" onClick={closeDialog}>Cancel</button>
        </div>
      </Sheet>
    </div>
  );
}