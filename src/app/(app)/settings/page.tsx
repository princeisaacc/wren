"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brain, ChevronDown, Lock, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { InstallButton } from "@/components/install-button";
import { Field } from "@/components/field";
import { useToast } from "@/components/toast";
import { useLoading } from "@/components/loading";
import { authMessage, useAuth, useProfile } from "@/components/auth-context";
import { useTheme, type Theme } from "@/components/theme";
import type { MemoryFact } from "@/lib/memory";
import { PERSONALITIES, DEFAULT_PERSONALITY, type PersonalityKey } from "@/lib/settings";
import { deleteAllConversations } from "@/lib/chat-store";

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

type Dialog = null | "profile" | "logout" | "delete" | "memory" | "cleardata";

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// ─── Memory section ───────────────────────────────────────────────────────────
function MemorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const token = async () => user!.getIdToken();

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    user
      .getIdToken()
      .then((tok) =>
        fetch("/api/memory", { headers: { Authorization: `Bearer ${tok}` } })
          .then((r) => r.json())
          .then((d) => { setFacts(d.facts ?? []); }),
      )
      .catch(() => toast.show("Could not load memory. Try closing and reopening this."))
      .finally(() => setLoading(false));
  }, [open, user, toast]);

  const deleteFact = async (id: string) => {
    setDeletingId(id);
    try {
      const tok = await token();
      const res = await fetch(`/api/memory?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
      const d = await res.json();
      if (d.deleted) { setFacts(d.facts); toast.show("Removed."); }
    } catch { toast.show("Could not remove that."); }
    finally { setDeletingId(null); }
  };

  const submitInstruction = async () => {
    if (!instruction.trim()) return;
    setSaving(true);
    try {
      const tok = await token();
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ instruction: instruction.trim() }),
      });
      const d = await res.json();
      if (d.updated) {
        setFacts(d.facts);
        setInstruction("");
        toast.show("Memory updated.");
      } else {
        toast.show("Nothing needed to change.");
      }
    } catch { toast.show("Could not update memory."); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="What Wren remembers">
      <h2 className="mb-1 text-lg font-semibold tracking-tight">What Wren remembers</h2>
      <p className="mb-4 text-sm text-sub">
        Wren builds this from your conversations. You can remove facts or tell Wren what to fix.
      </p>

      {loading ? (
        <p className="text-sm text-sub">Loading...</p>
      ) : facts.length === 0 ? (
        <p className="text-sm text-sub">Nothing remembered yet. Wren learns as you chat.</p>
      ) : (
        <ul className="mb-5 divide-y divide-line/60">
          {facts.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm">{f.fact}</p>
                <p className="mt-0.5 text-xs text-sub capitalize">{f.source}</p>
              </div>
              <button
                type="button"
                aria-label={`Remove: ${f.fact}`}
                disabled={deletingId === f.id}
                onClick={() => deleteFact(f.id)}
                className="shrink-0 rounded p-1 text-sub hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium">Tell Wren what to fix</p>
        <textarea
          className="input min-h-[80px] resize-none"
          placeholder="e.g. My favourite food is spag, not rice"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!instruction.trim() || saving}
            onClick={submitInstruction}
          >
            {saving ? "Updating..." : "Update memory"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Main settings page ───────────────────────────────────────────────────────
const TIMEZONES = ["Africa/Lagos", "Europe/London", "America/New_York", "Asia/Dubai"];
const REMINDER_TIMES = ["7:00 AM", "8:00 AM", "9:00 AM", "12:00 PM"];

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
  const [timezone, setTimezoneState] = useState("Africa/Lagos");
  const [defaultReminderTime, setDefaultReminderTime] = useState("8:00 AM");
  const [personality, setPersonality] = useState<PersonalityKey>(DEFAULT_PERSONALITY);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [usage, setUsage] = useState<{ dailyTokens: number; dailyLimit: number; conversationLimit: number } | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const closeDialog = () => {
    setDialog(null);
    setConfirmText("");
  };

  // Load saved settings once on mount.
  useEffect(() => {
    if (!auth.user) return;
    auth.user
      .getIdToken()
      .then((tok) => fetch("/api/settings", { headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.json()))
      .then((d) => {
        if (d.settings) {
          setTimezoneState(d.settings.timezone);
          setDefaultReminderTime(d.settings.defaultReminderTime);
          setAskBeforeChanges(d.settings.askBeforeChanges);
          if (d.settings.personality in PERSONALITIES) setPersonality(d.settings.personality);
        }
      })
      .catch(() => toast.show("Could not load your saved settings — showing defaults."))
      .finally(() => setSettingsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user]);

  // Today's token usage for the circle tracker. Reloads when the timezone changes,
  // since "today" resets at the user's own midnight.
  useEffect(() => {
    if (!auth.user || !settingsLoaded) return;
    auth.user
      .getIdToken()
      .then((tok) => fetch(`/api/usage?tz=${encodeURIComponent(timezone)}`, { headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.json()))
      .then((d) => { if (typeof d.dailyTokens === "number") setUsage(d); })
      .catch(() => {});
  }, [auth.user, settingsLoaded, timezone]);

  // Save one changed field, optimistic UI + toast on failure.
  const saveSetting = async (patch: Partial<{ timezone: string; defaultReminderTime: string; askBeforeChanges: boolean; personality: PersonalityKey }>) => {
    if (!auth.user) return;
    try {
      const tok = await auth.user.getIdToken();
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      toast.show("Could not save that change. Check your connection and try again.");
    }
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

      {/* Memory section */}
      <section className="card p-4" aria-labelledby="memory-h">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="memory-h" className="flex items-center gap-2 text-base font-semibold">
              <Brain className="h-4 w-4 text-brand" aria-hidden="true" />
              Memory
            </h2>
            <p className="mt-1 text-sm text-sub">
              Wren remembers things about you as you chat — your schedule, preferences and more — so it can give better answers over time.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm shrink-0"
            onClick={() => setDialog("memory")}
          >
            View & edit
          </button>
        </div>
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
            <Toggle
              label="Ask before adding or editing events and tasks"
              checked={askBeforeChanges}
              onChange={(v) => { setAskBeforeChanges(v); saveSetting({ askBeforeChanges: v }); }}
            />
          </li>
        </ul>
      </section>

      <section className="card p-4" aria-labelledby="general-h">
        <h2 id="general-h" className="mb-3 text-base font-semibold">General</h2>
        <div className="space-y-4">
          <Field label="Timezone">
            {({ id }) => (
              <select
                id={id}
                className="input"
                disabled={!settingsLoaded}
                value={timezone}
                onChange={(e) => { setTimezoneState(e.target.value); saveSetting({ timezone: e.target.value }); }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Default reminder time" hint="Used when you ask for a reminder without a time.">
            {({ id, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                className="input"
                disabled={!settingsLoaded}
                value={defaultReminderTime}
                onChange={(e) => { setDefaultReminderTime(e.target.value); saveSetting({ defaultReminderTime: e.target.value }); }}
              >
                {REMINDER_TIMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </section>

      <section className="card p-4" aria-labelledby="personality-h">
        <button
          type="button"
          onClick={() => setPersonalityOpen((v) => !v)}
          aria-expanded={personalityOpen}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 id="personality-h" className="text-base font-semibold">Personality</h2>
            <p className="mt-0.5 text-sm text-sub">
              {personalityOpen ? "Changes how Wren replies — not what it knows or does." : PERSONALITIES[personality].label}
            </p>
          </div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-sub transition-transform ${personalityOpen ? "rotate-180" : ""}`} />
        </button>
        {personalityOpen && (
          <div role="radiogroup" aria-labelledby="personality-h" className="mt-3 space-y-2">
            {(Object.keys(PERSONALITIES) as PersonalityKey[]).map((key) => {
              const p = PERSONALITIES[key];
              const active = personality === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!settingsLoaded}
                  onClick={() => { setPersonality(key); saveSetting({ personality: key }); setPersonalityOpen(false); }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? "border-brand bg-tint text-brand-dark" : "border-line bg-card text-ink hover:bg-softer"}`}
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className={`mt-0.5 text-xs ${active ? "text-brand-dark/80" : "text-sub"}`}>{p.blurb}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>


      <section className="card p-4" aria-labelledby="usage-h">
        <h2 id="usage-h" className="mb-3 text-base font-semibold">Usage today</h2>
        {usage ? (() => {
          const used = Math.min(usage.dailyTokens, usage.dailyLimit);
          const pct = usage.dailyLimit ? used / usage.dailyLimit : 0;
          const r = 42;
          const circ = 2 * Math.PI * r;
          const left = Math.max(usage.dailyLimit - usage.dailyTokens, 0);
          return (
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${Math.round(pct * 100)} percent of today's tokens used`}>
                  <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-current text-sub opacity-20" />
                  <circle
                    cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
                    className={`stroke-current ${pct >= 0.9 ? "text-danger" : "text-brand-dark"}`}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - pct)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-semibold">{Math.round(pct * 100)}%</span>
                  <span className="text-xs text-sub">used</span>
                </div>
              </div>
              <div className="text-sm">
                <p><span className="font-medium">{usage.dailyTokens.toLocaleString()}</span> of {usage.dailyLimit.toLocaleString()} tokens used</p>
                <p className="mt-0.5 text-sub">{left.toLocaleString()} left · resets at your midnight</p>
                <p className="mt-2 text-xs text-sub">Each conversation is also capped at {usage.conversationLimit.toLocaleString()} tokens. Start a new chat if you hit it.</p>
              </div>
            </div>
          );
        })() : (
          <p className="text-sm text-sub">Loading your usage…</p>
        )}
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
          <button type="button" className="btn btn-secondary" onClick={() => setDialog("cleardata")}>Clear my data</button>
          <button type="button" className="btn btn-secondary text-danger" onClick={() => setDialog("delete")}>Delete account</button>
        </div>
      </section>

      <footer className="flex flex-wrap gap-4 pb-4 text-xs text-sub">
        <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/contact" className="hover:text-ink">Contact</Link>
      </footer>

      {/* Sheets */}
      <MemorySheet open={dialog === "memory"} onClose={closeDialog} />

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

      <Sheet open={dialog === "cleardata"} onClose={closeDialog} title="Clear my data">
        <h2 className="text-lg font-semibold tracking-tight">Clear all conversations?</h2>
        <p className="mt-1 text-sm text-sub">
          This deletes every conversation and message in Wren. Your account, connections and settings stay as they are.
          This cannot be undone.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={clearingData}
            onClick={async () => {
              if (!auth.user) return;
              setClearingData(true);
              try {
                await overlay.run("Clearing your conversations...", () => deleteAllConversations(auth.user!.uid));
                closeDialog();
                toast.show("All conversations cleared.");
              } catch {
                toast.show("Could not clear everything. Try again.");
              } finally {
                setClearingData(false);
              }
            }}
          >
            Clear my data
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
                const code = (err as { code?: string } | undefined)?.code;
                if (code === "auth/requires-recent-login") {
                  toast.show("For security, please log out and back in, then delete your account again.");
                } else {
                  toast.show(authMessage(err));
                }
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