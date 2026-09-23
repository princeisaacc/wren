"use client";

import Link from "next/link";
import { Sheet } from "@/components/sheet";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, CircleAlert, History, Hourglass, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { useConnections } from "@/components/connections-context";
import { useToast } from "@/components/toast";
import {
  addMessage,
  createConversation,
  newConversationId,
  patchMessage,
  subscribeMessages,
  type ChatMessage,
  type EmailItem,
} from "@/lib/chat-store";
import type { AgentEvent, FinalEvent, PendingAction, Step } from "@/lib/agent-types";
import { services } from "@/lib/services";

const suggestions = [
  "What is on my calendar this week?",
  "Remind me to submit my ACC assignment tomorrow at 8am",
  "Show me my latest emails",
];

type Turns = { role: "user" | "assistant"; text: string }[];

// Short greetings and small talk are answered directly, with no tools and no steps.
const SMALL_TALK =
  /^(hi+|hey+|hello|hola|yo|sup|ok(ay)?|kk?|thanks?|thank you|thank u|thx|tnx|cool|nice|great|good (morning|afternoon|evening|night)|(i'?m|am|i am) (fine|good|okay|ok|great|well)|fine|lol|haha+|bye|goodbye|see you|sure|alright|noted|got it|yes|yeah|yep|no|nope|wow|amazing|awesome|perfect|how are you|omo+r?|abeg|ehen|hmm+|how far|how you dey|i dey|no wahala|wetin dey)\b/i;

// Anything that sounds like a request, or mentions a service, a day or a number, goes to the full assistant.
const NEEDS_TOOLS =
  /\b(add|send|show|find|check|remind|create|schedule|delete|cancel|open|list|search|read|reply|draft|save|move|update|change|what|when|where|which|who|why|how many|tell me|can you|could you|please)\b|calendar|meeting|event|mail|inbox|task|drive|file|doc|tomorrow|today|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d/i;

function isSmallTalk(history: Turns) {
  const text = (history[history.length - 1]?.text ?? "").trim();
  if (!text || text.length > 40 || !SMALL_TALK.test(text) || NEEDS_TOOLS.test(text)) return false;
  // An answer to a question Wren just asked may still need the tools.
  const before = history[history.length - 2];
  return !(before?.role === "assistant" && before.text.trim().endsWith("?"));
}

// What Wren prepared, and whether it worked, so it can remember and fix things in the next message.
function actionContext(m: ChatMessage) {
  if (!m.actions?.length) return "";
  return m.actions
    .map((a) => {
      const rows = a.rows.map((r) => `${r.label}: ${r.value}`).join("; ").slice(0, 700);
      const args = JSON.stringify(a.args).slice(0, 700);
      return `\n[Prepared: ${a.title}. ${a.summary} ${rows}. Details: ${args}. Status: ${a.status ?? "pending"}${a.error ? `. Error: ${a.error}` : ""}]`;
    })
    .join("");
}

function StepIcon({ state }: { state: Step["state"] }) {
  if (state === "done") return <Check className="h-4 w-4 text-brand" aria-hidden="true" />;
  if (state === "waiting") return <Hourglass className="h-4 w-4 text-sub" aria-hidden="true" />;
  if (state === "error") return <CircleAlert className="h-4 w-4 text-danger" aria-hidden="true" />;
  return <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />;
}

function Checklist({ steps }: { steps: Step[] }) {
  return (
    <ul className="space-y-1.5">
      {steps.map((s) => (
        <li key={s.id} className={`flex items-center gap-2 text-sm ${s.state === "running" ? "text-ink" : "text-sub"}`}>
          <span className="flex h-4 w-4 items-center justify-center">
            <StepIcon state={s.state} />
          </span>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

// After the work is done the steps fold away, and the user can open them again.
function StepsToggle({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 text-xs text-sub hover:text-ink">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
        {open ? "Hide steps" : `Show steps (${steps.length})`}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-soft p-3">
          <Checklist steps={steps} />
        </div>
      )}
    </div>
  );
}

function LiveProgress({ steps }: { steps: Step[] }) {
  const current = [...steps].reverse().find((s) => s.state === "running");
  return (
    <div className="card max-w-[92%] p-4" role="status" aria-live="polite">
      <p className="shimmer-text text-sm font-medium">{current ? `${current.label}...` : "Thinking..."}</p>
      {steps.length > 0 && (
        <div className="mt-3">
          <Checklist steps={steps} />
        </div>
      )}
    </div>
  );
}

function ActionCard({
  a,
  disabled,
  onConfirm,
  onCancel,
}: {
  a: PendingAction;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const open = a.status === "pending" || a.status === "failed" || !a.status;
  return (
    <div className="mt-3 rounded-lg border border-line/60 bg-soft p-3">
      <p className={`text-sm font-medium ${a.danger ? "text-danger" : ""}`}>{a.title}</p>
      {a.summary && <p className="mt-0.5 text-sm text-muted">{a.summary}</p>}
      {a.rows.length > 0 && (
        <dl className="mt-3 space-y-2 text-sm">
          {a.rows.map((r) =>
            r.long ? (
              <div key={r.label}>
                <dt className="text-sub">{r.label}</dt>
                <dd className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-card p-3">{r.value}</dd>
              </div>
            ) : (
              <div key={r.label} className="flex justify-between gap-4">
                <dt className="shrink-0 text-sub">{r.label}</dt>
                <dd className="break-words text-right font-medium">{r.value}</dd>
              </div>
            ),
          )}
        </dl>
      )}
      {a.status === "failed" && <p className="mt-3 text-sm text-danger">That did not go through. {a.error}</p>}
      {open && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" className={`btn btn-sm ${a.danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={disabled}>
            {a.status === "failed" ? "Try again" : a.title}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={disabled}>
            Cancel
          </button>
        </div>
      )}
      {a.status === "done" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-brand-dark">
          <Check className="h-4 w-4" aria-hidden="true" />
          Done
        </p>
      )}
      {a.status === "cancelled" && <p className="mt-3 text-sm text-sub">Cancelled</p>}
    </div>
  );
}

async function readEvents(res: Response, onEvent: (e: AgentEvent) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (line) onEvent(JSON.parse(line) as AgentEvent);
    }
  }
}

// ─── Email card components ────────────────────────────────────────────────────

type EmailDetail = EmailItem | null;

function EmailCard({ email, onClick }: { email: EmailItem; onClick: () => void }) {
  const timeStr = email.date
    ? (() => { try { return new Date(email.date!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); } catch { return ""; } })()
    : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg bg-soft p-3 text-left hover:bg-softer transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-ink">{email.from}</span>
        {timeStr && <span className="shrink-0 text-xs text-sub">{timeStr}</span>}
      </div>
      <p className="mt-0.5 truncate text-sm font-medium">{email.subject}</p>
      {email.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-sub">{email.snippet}</p>}
    </button>
  );
}

function EmailListCards({
  emails,
  onAction,
}: {
  emails: EmailItem[];
  onAction: (action: string, email: EmailItem) => void;
}) {
  const [detail, setDetail] = useState<EmailDetail>(null);
  return (
    <>
      <div className="mt-3 space-y-2">
        {emails.map((e) => (
          <EmailCard key={e.id} email={e} onClick={() => setDetail(e)} />
        ))}
      </div>
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.subject ?? "Email"}>
        {detail && (
          <div>
            <p className="text-xs text-sub">{detail.from}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{detail.subject}</h2>
            {detail.snippet && <p className="mt-2 text-sm text-muted">{detail.snippet}</p>}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setDetail(null); onAction("summarise", detail); }}
              >
                Summarise this email
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setDetail(null); onAction("reply", detail); }}
              >
                Reply to this
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setDetail(null); onAction("remind", detail); }}
              >
                Remind me to read this
              </button>
              <a
                href={`https://mail.google.com/mail/u/0/#inbox/${detail.threadId ?? detail.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary text-center"
              >
                Open in Gmail
              </a>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

function ChatInner() {
  const { user } = useAuth();
  const { show } = useToast();
  const { requestConnect, connected: sharedConnected } = useConnections();
  const router = useRouter();
  const params = useSearchParams();
  const cid = params.get("c");
  const uid = user?.uid;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const retry = useRef<{ id: string; history: Turns } | null>(null);
  // Tracks whether we've sent the full context (tool list + memory) in this conversation.
  // After the first message, we only send the conversation. pinned tools are ones unlocked
  // mid-conversation that must stay in context permanently.
  const contextSent = useRef(false);
  const [pinnedTools, setPinnedTools] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!uid || !cid) {
      setMessages([]);
      contextSent.current = false;
      setPinnedTools([]);
      return;
    }
    // New conversation — reset context flags
    contextSent.current = false;
    setPinnedTools([]);
    return subscribeMessages(uid, cid, setMessages, () => show("Could not load this conversation."));
  }, [uid, cid, show]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, steps, running]);

  // The message box grows with the text, up to 5 lines, then scrolls.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 122)}px`;
  }, [input]);

  const token = async () => await user!.getIdToken();

  const callRouter = async (
    id: string,
    history: Turns,
    note = true,
  ): Promise<{ slug: string; args?: Record<string, unknown> }[] | null> => {
    const connectedServices = Object.keys(sharedConnected ?? {}).filter(
      (k) => (sharedConnected as Record<string, boolean>)[k],
    );
    const isFirst = !contextSent.current;
    if (isFirst) contextSent.current = true;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({
        messages: history,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        connected: connectedServices,
        firstMessage: isFirst,
        pinnedTools,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as {
      reply?: string;
      tools?: { slug: string; args?: Record<string, unknown> }[];
      connect?: string;
      emails?: EmailItem[];
      provider?: string;
    };

    // Direct reply — router or direct-execute path answered without the agent.
    if (json.reply) {
      const reply = json.reply;
      // If this reply asks the user to connect a service, show the connect button via connect field
      await addMessage(
        user!.uid,
        id,
        "assistant",
        note ? `${reply}\n\nI could not reach your Google services just now, so I could not act on them.` : reply,
        {
          ...(json.connect ? { connect: json.connect as import("@/lib/services").ServiceKey } : {}),
          ...(json.emails ? { emails: json.emails } : {}),
        },
      );
      return null;
    }

    if (json.tools?.length) return json.tools;
    return null;
  };

  const generate = async (id: string, history: Turns) => {
    if (!user) return;
    setBusy(true);
    setError("");
    setSteps([]);
    let preTools: { slug: string; args?: Record<string, unknown> }[] | null = null;
    try {
      const routerResult = await callRouter(id, history, false);
      if (routerResult === null) {
        // Router answered directly (plain reply or direct-execute) — done.
        retry.current = null;
        setBusy(false);
        setSteps([]);
        return;
      }
      preTools = routerResult;
    } catch {
      // Router failed — let the agent decide on its own.
    }

    // Router returned write tools or a complex request — go to agent.
    const seen: Step[] = [];
    let final: FinalEvent | null = null;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          messages: history,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          pre_tools: preTools ?? undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`agent ${res.status}`);
      await readEvents(res, (ev) => {
        if (ev.t === "step") {
          const step = { id: ev.id, label: ev.label, state: ev.state };
          const i = seen.findIndex((s) => s.id === ev.id);
          if (i >= 0) seen[i] = step;
          else seen.push(step);
          setSteps([...seen]);
        } else if (ev.t === "final") {
          final = ev;
        } else {
          throw new Error("agent");
        }
      });
      if (!final) throw new Error("agent");
      const f: FinalEvent = final;
      const kept = seen.map((s) => (s.state === "running" ? { ...s, state: "done" as const } : s));
      await addMessage(user.uid, id, "assistant", f.text, {
        steps: kept.length > 1 ? kept : undefined,
        actions: f.actions?.map((a) => ({ ...a, status: "pending" as const })),
        connect: f.connect,
      });
      retry.current = null;
    } catch (err) {
      console.error("Wren agent error:", err);
      try {
        await callRouter(id, history);
        retry.current = null;
      } catch {
        retry.current = { id, history };
        setError("Wren could not reply. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
      setSteps([]);
    }
  };

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || busy || !user) return;
    setInput("");
    setError("");
    setBusy(true);
    try {
      let id = cid;
      if (!id) {
        id = newConversationId(user.uid);
        router.replace(`/chat?c=${id}`);
        await createConversation(user.uid, id, value);
      }
      await addMessage(user.uid, id, "user", value);
      const history: Turns = [
        ...messages.map((m) => ({ role: m.role, text: m.text + actionContext(m) })),
        { role: "user", text: value },
      ];
      await generate(id, history);
    } catch {
      setError("Could not save your message. Check your connection and try again.");
      setBusy(false);
    }
  };

  // Called when user taps an action button inside the email sheet
  const handleEmailAction = (action: string, email: EmailItem) => {
    const actions: Record<string, string> = {
      summarise: `Summarise the email from ${email.from} with subject "${email.subject}" (message id: ${email.id})`,
      reply: `I want to reply to the email from ${email.from} with subject "${email.subject}" (message id: ${email.id}, thread id: ${email.threadId ?? email.id})`,
      remind: `Remind me tomorrow morning to read the email from ${email.from} about "${email.subject}"`,
    };
    send(actions[action] ?? `Open email ${email.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // On phones Enter adds a new line and the arrow button sends. On a computer Enter sends.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    send(input);
  };

  const patchAction = (m: ChatMessage, actionId: string, patch: Partial<PendingAction>) =>
    patchMessage(user!.uid, cid!, m.id, { actions: m.actions?.map((x) => (x.id === actionId ? { ...x, ...patch } : x)) });

  const confirmAction = async (m: ChatMessage, a: PendingAction) => {
    if (!user || !cid) return;
    setRunning(a.running);
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ tool: a.tool, args: a.args }),
      });
      const data = (await res.json()) as { ok?: boolean; text?: string; error?: string; link?: string; linkLabel?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "");
      await patchAction(m, a.id, { status: "done", error: undefined });
      await addMessage(user.uid, cid, "assistant", data.text ?? "Done.", {
        steps: [{ id: 1, label: a.running, state: "done" }],
        link: data.link,
        linkLabel: data.linkLabel,
      });
    } catch (e) {
      await patchAction(m, a.id, { status: "failed", error: e instanceof Error ? e.message.slice(0, 200) : "" });
      show("That did not go through. You can try again.");
    } finally {
      setRunning(null);
    }
  };

  const cancelAction = async (m: ChatMessage, a: PendingAction) => {
    if (!user || !cid) return;
    await patchAction(m, a.id, { status: "cancelled" });
    await addMessage(user.uid, cid, "assistant", "Okay, I did not do that.");
  };

  const time = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const working = busy || running !== null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-3xl flex-col px-4 md:h-dvh md:px-8">
      <div className="flex items-center justify-between gap-2 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Chat</h1>
        <div className="flex gap-2">
          <Link href="/history" className="btn btn-secondary btn-sm">
            <History className="h-4 w-4" aria-hidden="true" />
            History
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setError("");
              router.push("/chat");
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New chat
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-2" aria-live="polite">
        {!cid && messages.length === 0 && (
          <div className="pt-6">
            <h2 className="text-lg font-semibold tracking-tight">What can I do for you?</h2>
            <p className="mt-1 text-sm text-sub">Ask in plain language. I will ask you before I change anything.</p>
            <div className="mt-4 flex flex-col gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="card px-4 py-3 text-left text-sm hover:bg-soft">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl bg-tint px-4 py-3">
                <p className="whitespace-pre-wrap text-sm">{m.text}</p>
                <p className="mt-1 text-right text-xs text-sub">{time(m.ts)}</p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="card max-w-[92%] p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-sub">
                <span className="font-medium text-ink">Wren</span>
                <span>{time(m.ts)}</span>
              </div>
              {m.steps && m.steps.length > 0 && <StepsToggle steps={m.steps} />}
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              {m.emails && m.emails.length > 0 && (
                <EmailListCards emails={m.emails} onAction={handleEmailAction} />
              )}
              {m.actions?.map((a) => (
                <ActionCard key={a.id} a={a} disabled={working} onConfirm={() => confirmAction(m, a)} onCancel={() => cancelAction(m, a)} />
              ))}
              {m.link && (
                <a href={m.link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
                  {m.linkLabel ?? "Open"}
                </a>
              )}
              {m.connect && (
                <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => {
                  // Pin this service's tools so they stay in context after connection
                  const svc = m.connect!;
                  setPinnedTools((prev) => prev.includes(svc) ? prev : [...prev, svc]);
                  // Reset context so next message re-sends with the new pinned tools
                  contextSent.current = false;
                  requestConnect(svc);
                }}>
                  Connect {services[m.connect!].name}
                </button>
              )}
            </div>
          ),
        )}

        {busy && <LiveProgress steps={steps} />}
        {running && <LiveProgress steps={[{ id: 1, label: running, state: "running" }]} />}
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-ink">
            <span>{error}</span>
            {retry.current && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => retry.current && generate(retry.current.id, retry.current.history)}>
                Try again
              </button>
            )}
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-line/60 bg-canvas py-3"
      >
        <label htmlFor="chat-input" className="sr-only">Message Wren</label>
        <textarea
          ref={box}
          id="chat-input"
          rows={1}
          className="input h-auto max-h-[122px] min-h-11 resize-none overflow-y-auto py-2.5 leading-5"
          placeholder="Tell Wren what you need"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        <button type="submit" aria-label="Send" className="btn btn-primary w-11 shrink-0 px-0" disabled={!input.trim() || working}>
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}