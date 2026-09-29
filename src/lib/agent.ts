import { bySlug, type ToolInfo } from "@/lib/agent-tools";
import type { ActionRow, AgentEvent, PendingAction } from "@/lib/agent-types";
import type { ServiceKey } from "@/lib/services";

export type Part = {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  [key: string]: unknown;
};
export type Content = { role: "user" | "model"; parts: Part[] };

export type AgentDeps = {
  contents: Content[];
  callModel: (contents: Content[], opts?: { noTools?: boolean }) => Promise<Content>;
  execute: (slug: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: string | null }>;
  emit: (event: AgentEvent) => void;
  maxRounds?: number;
  // From the user's Settings > "Ask before adding or editing events and tasks" toggle.
  // Only ever relaxes confirmation for non-destructive calendar/tasks writes — deleting
  // anything and every Gmail write still always waits for confirmation, no matter this value.
  askBeforeChanges?: boolean;
};

const SERVICES: ServiceKey[] = ["calendar", "tasks", "gmail", "drive"];
const HIDDEN = new Set(["user_id", "wren_summary", "is_html", "verbose"]);

const LABELS: Record<string, string> = {
  summary: "Title",
  title: "Title",
  name: "Name",
  start_datetime: "Starts",
  end_datetime: "Ends",
  start: "Starts",
  end: "Ends",
  due: "Due",
  timezone: "Time zone",
  recipient_email: "To",
  to: "To",
  cc: "Cc",
  bcc: "Bcc",
  subject: "Subject",
  body: "Message",
  description: "Description",
  notes: "Notes",
  location: "Location",
  attendees: "Guests",
};

const RANK: RegExp[] = [/recipient|^to$|attendee/, /subject|summary|title|^name$/, /body|description|notes|content|text/, /start|due/, /end/];
const rank = (key: string) => {
  const i = RANK.findIndex((r) => r.test(key));
  return i < 0 ? RANK.length : i;
};

function humanLabel(key: string) {
  if (LABELS[key]) return LABELS[key];
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Turns 2026-09-21T15:00:00+01:00 into "Mon 21 Sep, 3:00 PM" using the time as written.
function niceDate(v: string): string | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, zone] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  let out = `${DAYS[date.getUTCDay()]} ${+d} ${MONTHS[+mo - 1]}`;
  const dateOnly = hh === undefined || (zone === "Z" && hh === "00" && mm === "00");
  if (!dateOnly) {
    const h = +hh;
    out += `, ${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
    if (zone === "Z") out += " UTC";
  }
  return out;
}

function show(value: unknown): string {
  if (typeof value === "string") return niceDate(value) ?? value;
  if (Array.isArray(value)) return value.map(show).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function toRows(args: Record<string, unknown>): ActionRow[] {
  return Object.entries(args)
    .filter(([k, v]) => !HIDDEN.has(k) && !/(^|_)id$/.test(k) && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([k, v]) => {
      const value = show(v).slice(0, 3000);
      return { label: humanLabel(k), value, long: value.length > 80 || value.includes("\n") };
    });
}

function makeAction(info: ToolInfo, args: Record<string, unknown>): PendingAction {
  const { wren_summary, ...clean } = args;
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    tool: info.slug,
    service: info.service as ServiceKey,
    title: info.title ?? "Confirm",
    summary: typeof wren_summary === "string" ? wren_summary.slice(0, 300) : "",
    danger: !!info.danger,
    running: info.running ?? "Working",
    done: info.done ?? "Done.",
    rows: toRows(clean),
    args: clean,
    status: "pending",
  };
}

const BULKY = new Set(["payload", "raw", "attachmentList", "attachments", "labelIds"]);

// Cuts long text and drops bulky fields so several emails or events fit in one result.
function compact(v: unknown, limit: number, depth = 0): unknown {
  if (typeof v === "string") return v.length > limit ? `${v.slice(0, limit)}...` : v;
  if (Array.isArray(v)) return v.slice(0, 15).map((x) => compact(x, limit, depth + 1));
  if (v && typeof v === "object" && depth < 8) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !BULKY.has(k))
        .map(([k, x]) => [k, compact(x, limit, depth + 1)]),
    );
  }
  return v;
}

function shrink(data: unknown, slug: string): Record<string, unknown> {
  const limit = /FETCH_EMAILS|EVENTS_LIST|LIST_ALL_TASKS|LIST_TASK_LISTS|FIND_FILE|COMPOSIO_SEARCH_(DUCK|NEWS|FINANCE)/.test(slug) ? 300 : 2500;
  const out = compact(data, limit);
  const text = JSON.stringify(out) ?? "";
  return text.length > 6000 ? { result: text.slice(0, 6000), truncated: true } : { result: out };
}

// Strip ALL markdown from AI output so it never reaches the user as raw symbols.
const clean = (t: string) =>
  t
    .replace(/\*\*(.+?)\*\*/g, "$1")        // **bold**
    .replace(/\*(.+?)\*/g, "$1")              // *italic*
    .replace(/^#{1,6}\s+/gm, "")              // ## headings
    .replace(/^[-*]\s+/gm, "\u2022 ")          // - bullets → •
    .replace(/`{1,3}([^`\n]+)`{1,3}/g, "$1")  // `code`
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")      // [links](url)
    .replace(/_{1,2}(.+?)_{1,2}/g, "$1")       // _italic_ __bold__
    .replace(/~~(.+?)~~/g, "$1")               // ~~strikethrough~~
    .replace(/^>\s*/gm, "")                    // > blockquotes
    .replace(/\n{3,}/g, "\n\n")               // excess blank lines
    .trim();

// Catches requests the service would refuse, so the assistant can fix them before the user sees a card.
function problemWith(slug: string, args: Record<string, unknown>): string | null {
  if ((slug === "GMAIL_SEND_EMAIL" || slug === "GMAIL_REPLY_TO_THREAD") && !args.recipient_email && !args.cc && !args.bcc) {
    return "recipient_email is missing. Use the sender's email address from the message being answered, or ask the user for it.";
  }
  return null;
}

const fr = (name: string, response: Record<string, unknown>, callId?: string): Part => ({
  functionResponse: { name, response },
  ...(callId ? { callId } : {}),
});

export async function runAgent(deps: AgentDeps) {
  const { callModel, execute, emit } = deps;
  const askBeforeChanges = deps.askBeforeChanges ?? true;
  const contents = [...deps.contents];
  let step = 0;

  const first = ++step;
  emit({ t: "step", id: first, label: "Understanding your request", state: "running" });
  let firstDone = false;

  const maxRounds = deps.maxRounds ?? 4;
  let toolCalls = 0;
  let toolFailures = 0;

  for (let round = 0; round < maxRounds; round++) {
    // On the last round, after enough tool calls, or once tools have failed twice,
    // the assistant must answer with what it has instead of retrying again.
    const noTools = round === maxRounds - 1 || toolCalls >= 4 || toolFailures >= 2;
    const reply = await callModel(contents, noTools ? { noTools: true } : undefined);
    if (!firstDone) {
      emit({ t: "step", id: first, label: "Understanding your request", state: "done" });
      firstDone = true;
    }

    const parts = reply.parts.filter((p) => !p.thought);
    const text = parts.map((p) => p.text ?? "").join("").trim();
    const calls = parts.filter((p) => p.functionCall);

    if (!calls.length || noTools) {
      emit({ t: "final", text: clean(text) || "I could not finish that. Please try again." });
      return;
    }
    toolCalls += calls.length;

    calls.forEach((p, i) => {
      if (!p.callId) p.callId = `call_${round}_${i}`;
    });
    contents.push(reply);
    const responses: Part[] = [];
    const pending: PendingAction[] = [];

    for (const part of calls) {
      const { name, args = {} } = part.functionCall as { name: string; args?: Record<string, unknown> };
      const callId = String(part.callId);

      if (name === "request_connection") {
        const service = SERVICES.find((s) => s === args.service);
        emit({ t: "final", text: clean(text) || "To do that, please connect the service first.", connect: service });
        return;
      }

      const info = bySlug[name];
      if (!info) {
        responses.push(fr(name, { error: "Unknown tool." }, callId));
        continue;
      }

      if (info.write) {
        const problem = problemWith(name, args);
        if (problem) {
          responses.push(fr(name, { error: problem }, callId));
          continue;
        }

        // Non-destructive calendar/tasks writes skip the confirm card when the user has
        // turned "Ask before adding or editing events and tasks" off. Deletes and every
        // Gmail write always confirm, regardless of this setting.
        const canAutoRun = !askBeforeChanges && !info.danger && (info.service === "calendar" || info.service === "tasks");
        if (canAutoRun) {
          const id = ++step;
          emit({ t: "step", id, label: info.step, state: "running" });
          try {
            const res = await execute(name, args);
            if (res.error) {
              toolFailures++;
              console.error(`[WREN] tool ${name} failed: ${String(res.error).slice(0, 300)}`);
              emit({ t: "step", id, label: info.step, state: "error" });
              responses.push(fr(name, { error: String(res.error).slice(0, 500) }, callId));
            } else {
              emit({ t: "step", id, label: info.done ?? info.step, state: "done" });
              responses.push(fr(name, shrink(res.data, name), callId));
            }
          } catch (e) {
            toolFailures++;
            console.error(`[WREN] tool ${name} crashed: ${e instanceof Error ? e.message.slice(0, 300) : "unknown"}`);
            emit({ t: "step", id, label: info.step, state: "error" });
            responses.push(fr(name, { error: "The tool failed." }, callId));
          }
          continue;
        }

        emit({ t: "step", id: ++step, label: info.step, state: "done" });
        pending.push(makeAction(info, args));
        responses.push(fr(name, { status: "waiting for the user to confirm" }, callId));
        continue;
      }

      const id = ++step;
      emit({ t: "step", id, label: info.step, state: "running" });
      try {
        const res = await execute(name, args);
        if (res.error) {
          toolFailures++;
          console.error(`[WREN] tool ${name} failed: ${String(res.error).slice(0, 300)}`);
          emit({ t: "step", id, label: info.step, state: "error" });
          responses.push(fr(name, { error: String(res.error).slice(0, 500) }, callId));
        } else {
          emit({ t: "step", id, label: info.step, state: "done" });
          responses.push(fr(name, shrink(res.data, name), callId));
        }
      } catch (e) {
        toolFailures++;
        console.error(`[WREN] tool ${name} crashed: ${e instanceof Error ? e.message.slice(0, 300) : "unknown"}`);
        emit({ t: "step", id, label: info.step, state: "error" });
        responses.push(fr(name, { error: "The tool failed." }, callId));
      }
    }

    if (pending.length) {
      emit({ t: "step", id: ++step, label: "Waiting for your confirmation", state: "waiting" });
      emit({ t: "final", text: clean(text) || "Here is what I am about to do. Please check it and confirm.", actions: pending });
      return;
    }

    contents.push({ role: "user", parts: responses });
  }

  emit({ t: "final", text: "That needed more steps than I can take in one go. Please try a simpler request." });
}