import { NextResponse } from "next/server";
import { buildAttempts, lastResortReply } from "@/lib/ai-keys";
import { checkUsage, recordUsage, limitMessage } from "@/lib/usage";
import { PERSONALITIES, DEFAULT_PERSONALITY, type PersonalityKey } from "@/lib/settings";
import { userSession } from "@/lib/composio";
import { footballScores, FOOTBALL_SLUG } from "@/lib/football";
import {
  readMemoryStore,
  writeMemoryStore,
  applyMemoryOps,
  parseMemoryOps,
  stripMemoryTags,
  memoryBlock,
  MEMORY_INSTRUCTIONS,
} from "@/lib/memory";

export const runtime = "nodejs";

// Strip markdown formatting from AI replies so they never reach the user as raw symbols
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")      // **bold**
    .replace(/\*(.+?)\*/g, "$1")            // *italic*
    .replace(/^#{1,6}\s+/gm, "")            // ## headings
    .replace(/^[-*]\s+/gm, "• ")            // - bullets → •
    .replace(/^\d+\.\s+/gm, (m) => m)     // keep numbered lists
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")  // `code`
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")  // [links](url)
    .replace(/_{1,2}(.+?)_{1,2}/g, "$1")    // _italic_ __bold__
    .replace(/~~(.+?)~~/g, "$1")             // ~~strikethrough~~
    .replace(/^>\s+/gm, "")                 // > blockquotes
    .replace(/\n{3,}/g, "\n\n")            // excess blank lines
    .trim();
}

export const maxDuration = 30;

type Msg = { role: "user" | "assistant"; text: string };

// ─── Token counter (approximate — 1 token ≈ 4 chars) ─────────────────────────
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Terminal logger ──────────────────────────────────────────────────────────
function log(path: string, detail: string, tokens?: Record<string, number>) {
  const tok = tokens
    ? " | " + Object.entries(tokens).map(([k, v]) => `${k}:${v}tok`).join(" ") + ` total:${Object.values(tokens).reduce((a, b) => a + b, 0)}tok`
    : "";
  console.log(`[WREN] ${path} → ${detail}${tok}`);
}

// ─── Tool list ────────────────────────────────────────────────────────────────
const ROUTABLE_TOOLS = [
  { slug: "GOOGLECALENDAR_EVENTS_LIST",         service: "calendar", description: "List events. args: none needed" },
  { slug: "GOOGLECALENDAR_FIND_FREE_SLOTS",      service: "calendar", description: "Find free slots." },
  { slug: "GOOGLECALENDAR_CREATE_EVENT",         service: "calendar", write: true, description: "Create event. args: summary, start_datetime(ISO), end_datetime(ISO), timezone" },
  { slug: "GOOGLECALENDAR_PATCH_EVENT",          service: "calendar", write: true, description: "Edit event. args: event_id, fields to change" },
  { slug: "GOOGLECALENDAR_DELETE_EVENT",         service: "calendar", write: true, description: "Delete event. args: event_id" },
  { slug: "GOOGLETASKS_LIST_ALL_TASKS",          service: "tasks",    description: "List tasks." },
  { slug: "GOOGLETASKS_INSERT_TASK",             service: "tasks",    write: true, description: "Add task. args: title, due(ISO)" },
  { slug: "GOOGLETASKS_PATCH_TASK",              service: "tasks",    write: true, description: "Edit task. args: task_id, fields" },
  { slug: "GOOGLETASKS_DELETE_TASK",             service: "tasks",    write: true, description: "Delete task. args: task_id" },
  { slug: "GMAIL_FETCH_EMAILS",                  service: "gmail",    description: "Fetch emails. args: max_results(default 5), label (INBOX default, SENT for outbox/sent mail, DRAFT for drafts)" },
  { slug: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",   service: "gmail",    description: "Read one email. args: message_id" },
  { slug: "GMAIL_SEND_EMAIL",                    service: "gmail",    write: true, description: "Send email. args: recipient_email, subject, body" },
  { slug: "GMAIL_REPLY_TO_THREAD",               service: "gmail",    write: true, description: "Reply to email. args: thread_id, recipient_email, message_body" },
  { slug: "GMAIL_CREATE_EMAIL_DRAFT",            service: "gmail",    write: true, description: "Draft email. args: recipient_email, subject, body" },
  { slug: "GOOGLEDRIVE_FIND_FILE",               service: "drive",    description: "Find file. args: query" },
  { slug: "GOOGLEDRIVE_GET_DOCUMENT",            service: "drive",    description: "Read doc. args: document_id" },
  { slug: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT",   service: "drive",    write: true, description: "Create file. args: file_name, content" },
  { slug: "COMPOSIO_SEARCH_DUCK_DUCK_GO", description: "Web search. args: query" },
  { slug: "COMPOSIO_SEARCH_NEWS",         description: "News search. args: query" },
  { slug: "COMPOSIO_SEARCH_FINANCE",      description: "Finance/stocks. args: query" },
  { slug: "COMPOSIO_SEARCH_FETCH_URL_CONTENT",   description: "Fetch URL. args: url" },
  { slug: "WREN_FOOTBALL_SCORES",                description: "Football scores. args: team/league/date(optional)" },
] as const;

type ToolSlug = typeof ROUTABLE_TOOLS[number]["slug"];
type RouteDecision =
  | { kind: "answer"; reply: string }
  | { kind: "need_info"; question: string }
  | { kind: "tools"; tools: { slug: ToolSlug; args: Record<string, unknown> }[] }
  | { kind: "connect"; service: string; message: string };

// Read-only tools executed directly — no agent, no schema tokens.
const DIRECT_READ_SLUGS = new Set([
  "GOOGLECALENDAR_EVENTS_LIST",
  "GOOGLECALENDAR_FIND_FREE_SLOTS",
  "GOOGLETASKS_LIST_ALL_TASKS",
  "GMAIL_FETCH_EMAILS",
  "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",
  "GOOGLEDRIVE_FIND_FILE",
  "GOOGLEDRIVE_GET_DOCUMENT",
  "COMPOSIO_SEARCH_DUCK_DUCK_GO",
  "COMPOSIO_SEARCH_NEWS",
  "COMPOSIO_SEARCH_FINANCE",
  "COMPOSIO_SEARCH_FETCH_URL_CONTENT",
  "WREN_FOOTBALL_SCORES",
]);

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function verifyToken(token: string): Promise<{ uid: string; name: string } | null> {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const u = data?.users?.[0];
  return u ? { uid: String(u.localId), name: u.displayName ? String(u.displayName) : "" } : null;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
// Services we know about and their display names for connect prompts
const SERVICE_NAMES: Record<string, string> = {
  calendar: "Google Calendar",
  tasks: "Google Tasks",
  gmail: "Gmail",
  drive: "Google Drive",
};

function routerPrompt(
  name: string,
  timezone: string,
  connected: string[],
  memory: string,
  isFirstMessage: boolean,
  pinnedTools: string[],
  defaultReminderTime: string,
  personality: PersonalityKey,
) {
  const now = new Date().toLocaleString("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "short" });
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date()).replace(/-/g, "");

  // On first message: send tools for connected services + always-available tools (web search, football)
  // On subsequent messages: send NO tool list (it's already in context from message 1)
  // EXCEPT: if pinnedTools contains slugs that were unlocked mid-conversation, always include those
  let toolSection = "";
  if (isFirstMessage || pinnedTools.length > 0) {
    const toolsToShow = ROUTABLE_TOOLS.filter((t) => {
      const svc = ("service" in t ? (t as { service?: string }).service : undefined);
      if (!svc) return isFirstMessage; // web/football tools only on first message
      if (connected.includes(svc)) return true; // connected service
      if (pinnedTools.some((p) => p.startsWith(svc.toUpperCase()))) return true; // pinned mid-convo
      return false;
    });

    if (toolsToShow.length > 0) {
      toolSection = `\nAction labels (NOT functions — just put the slug in JSON):\n` +
        toolsToShow.map((t) => `- ${t.slug}: ${t.description}`).join("\n") + "\n";
    }
  }

  // Context block — only sent on first message
  const contextBlock = isFirstMessage ? `
User: ${name || "unknown"}. Now: ${now} (${timezone}). Today YYYYMMDD: ${ymd}.
Connected: ${connected.length ? connected.map((s) => SERVICE_NAMES[s] ?? s).join(", ") : "no Google services"}.
Default reminder time: ${defaultReminderTime} — use this if the user asks for a reminder/task with no time given, instead of asking.
Tone: ${PERSONALITIES[personality].prompt}
${memory}${toolSection}` : `Now: ${now} (${timezone}). YYYYMMDD: ${ymd}.${toolSection ? "\n" + toolSection : ""}`;

  const memInstructions = isFirstMessage ? `\n${MEMORY_INSTRUCTIONS}\n` : "";

  return `You are Wren's router. Output a JSON routing decision only. Do NOT call functions yourself.
${contextBlock}
Reply with ONE of:
{"kind":"answer","reply":"..."}
{"kind":"need_info","question":"..."}
{"kind":"tools","tools":[{"slug":"SLUG","args":{}}]}
{"kind":"connect","service":"gmail","message":"To check your email, connect Gmail first."}

Rules: small talk→answer. Missing arg→need_info. Need a disconnected service→connect. Otherwise→tools.
One tool only. Calendar: infer dates. Email: max_results=5 default. Do not invent facts.
"Outbox" or "sent mail" → GMAIL_FETCH_EMAILS with label:SENT, never plain inbox. "My drafts" or "draft email" → GMAIL_FETCH_EMAILS with label:DRAFT — never assume Drive.
CRITICAL: "answer" means small talk or a question ONLY — never use it for anything the user is asking you to DO (remind, add, set, schedule, send, check, save, delete, look up, find). NEVER claim to have done, set, sent, saved, scheduled, or found anything unless its tool is listed above AND you are outputting "tools" with that exact slug right now. If the request sounds like an action and no matching tool is listed above (it may not be shown on this message), output {"kind":"tools","tools":[]} — an empty tools list still hands this off correctly, and that is always safer than answering as if you did something.
${memInstructions}
After JSON, write memory tags if user revealed something personal:
[[remember: ...]] or [[update: fN → ...]] or [[forget: fN]]`;
}

function answerPrompt(name: string, timezone: string, memory: string) {
  const now = new Date().toLocaleString("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "short" });
  return [
    "You are Wren, a warm and capable personal assistant. You have a personality — be friendly, natural and human. Not robotic.",
    name ? `The user's name is ${name}.` : "",
    `Now: ${now} (${timezone}). The user is often a student or young professional in Nigeria.`,
    memory,
    "Reply in plain text. No markdown. No em dashes. Match the user's energy — casual if they're casual, focused if they're focused. Keep replies concise but never cold.",
    MEMORY_INSTRUCTIONS,
  ].filter(Boolean).join(" ");
}

function summariserPrompt(name: string, timezone: string, memory: string, slug: string) {
  const now = new Date().toLocaleString("en-GB", { timeZone: timezone, timeStyle: "short" });
  const isEmail = slug.includes("GMAIL");
  const isCalendar = slug.includes("CALENDAR") || slug.includes("TASKS");
  const isSearch = slug.includes("SEARCH") || slug.includes("FOOTBALL");

  let format = "Plain text only. No markdown. No em dashes.";
  if (isEmail) format = "List each email as: [number]. From [sender] — [subject]. One email per line. After the list, add one short friendly line offering to open or reply to any of them.";
  if (isCalendar) format = "List each event/task as: [time or date] — [title]. After the list, offer to help with any of them. If nothing found, say so warmly.";
  if (isSearch) format = "Answer naturally using what the data says. Be concise but complete.";

  return [
    "You are Wren, a warm and helpful personal assistant. Reply based ONLY on the data provided. Be friendly and natural — you have a personality.",
    name ? `User's name is ${name} — use it naturally, not on every sentence.` : "",
    `Now: ${now} (${timezone}).`,
    format,
    MEMORY_INSTRUCTIONS,
  ].filter(Boolean).join(" ");
}

// ─── AI caller ────────────────────────────────────────────────────────────────
async function callAI(
  system: string,
  messages: Msg[],
  json = false,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const inputTokens = countTokens(system) + messages.reduce((s, m) => s + countTokens(m.text), 0);
  const attempts = buildAttempts();
  if (!attempts.length) throw new Error("no AI keys configured");

  for (const attempt of attempts) {
    const { provider, key } = attempt;
    try {
      if (provider === "groq") {
        const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            max_tokens: json ? 400 : 300,
            // tool_choice removed — Groq confirmed it doesn't reliably stop gpt-oss from emitting a
            // tool-call shape, and just turns that into a hard 400 instead of parseable text.
            ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
            ...(json ? { response_format: { type: "json_object" } } : {}),
            messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.text }))],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
        if (!text) throw new Error("groq empty");
        const outputTokens = countTokens(text);
        return { text, inputTokens, outputTokens };
      } else {
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
            generationConfig: {
              maxOutputTokens: json ? 400 : 300,
              ...(json ? { responseMimeType: "application/json" } : {}),
              ...(model.includes("2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p) => p.text ?? "").join("").trim();
        if (!text) throw new Error("gemini empty");
        const outputTokens = countTokens(text);
        return { text, inputTokens, outputTokens };
      }
    } catch (e) {
      console.error(`router ${attempt.id} failed:`, e instanceof Error ? e.message : "unknown");
    }
  }
  throw new Error("all providers/keys failed");
}

// ─── Decision parser ──────────────────────────────────────────────────────────
// The router reply may contain JSON + memory tags on separate lines.
// We split them so both can be processed.
function parseRouterReply(raw: string): { decision: RouteDecision | null; memoryPart: string } {
  // Memory tags can appear after the JSON block
  const jsonEnd = raw.lastIndexOf("}");
  const jsonPart = jsonEnd >= 0 ? raw.slice(0, jsonEnd + 1) : raw;
  const memoryPart = jsonEnd >= 0 ? raw.slice(jsonEnd + 1) : "";

  try {
    const cleaned = jsonPart.replace(/```json|```/g, "").trim();
    const d = JSON.parse(cleaned);
    if (d.kind === "answer" && typeof d.reply === "string") return { decision: d as RouteDecision, memoryPart };
    if (d.kind === "need_info" && typeof d.question === "string") return { decision: d as RouteDecision, memoryPart };
    if (d.kind === "tools" && Array.isArray(d.tools) && d.tools.length > 0) return { decision: d as RouteDecision, memoryPart };
    if (d.kind === "connect" && typeof d.service === "string") return { decision: d as RouteDecision, memoryPart };
    return { decision: null, memoryPart };
  } catch {
    return { decision: null, memoryPart };
  }
}

// ─── Tool arg normaliser ──────────────────────────────────────────────────────
function normalizeArgs(slug: string, args: Record<string, unknown>): Record<string, unknown> {
  if (slug !== "GMAIL_FETCH_EMAILS") return args;
  const n = Number(args.max_results);
  return { ...args, max_results: Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 15) : 5 };
}

// ─── Data compactor ───────────────────────────────────────────────────────────
function compactData(data: unknown, slug: string): string {
  const limit = /FETCH_EMAILS|EVENTS_LIST|LIST_ALL_TASKS|FIND_FILE|COMPOSIO_SEARCH/.test(slug) ? 150 : 1200;
  // For email fetches, only keep the fields we actually need
  const isEmailSlug = slug.includes("GMAIL_FETCH");

  function compact(v: unknown, depth = 0): unknown {
    if (typeof v === "string") return v.length > limit ? `${v.slice(0, limit)}...` : v;
    if (Array.isArray(v)) return v.slice(0, 10).map((x) => compact(x, depth + 1));
    if (v && typeof v === "object" && depth < 6) {
      const ALWAYS_DROP = new Set(["payload", "raw", "attachmentList", "attachments", "labelIds", "historyId", "internalDate", "sizeEstimate"]);
      const EMAIL_KEEP = new Set(["id", "threadId", "from", "to", "subject", "date", "snippet"]);
      const entries = Object.entries(v as Record<string, unknown>)
        .filter(([k]) => {
          if (ALWAYS_DROP.has(k)) return false;
          if (isEmailSlug && depth >= 1 && !EMAIL_KEEP.has(k)) return false;
          return true;
        })
        .map(([k, x]) => [k, compact(x, depth + 1)]);
      return Object.fromEntries(entries);
    }
    return v;
  }
  const out = JSON.stringify(compact(data)) ?? "";
  return out.length > 5000 ? out.slice(0, 5000) + "..." : out;
}

// ─── Email extractor — pulls structured email list from raw Composio data ────────
type EmailItem = { id: string; threadId?: string; from: string; subject: string; date?: string; snippet?: string };

function extractEmails(data: unknown): EmailItem[] {
  const items: EmailItem[] = [];

  // Helper: dig through nested header arrays like [{name:"From",value:"..."}]
  function parseHeaders(headers: unknown): Record<string, string> {
    if (!headers) return {};
    if (Array.isArray(headers)) {
      const result: Record<string, string> = {};
      for (const h of headers as unknown[]) {
        if (h && typeof h === "object") {
          const hObj = h as Record<string, unknown>;
          const name = String(hObj.name ?? "").toLowerCase();
          const value = String(hObj.value ?? "");
          if (name) result[name] = value;
        }
      }
      return result;
    }
    if (typeof headers === "object") return headers as Record<string, string>;
    return {};
  }

  function walk(v: unknown): void {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { (v as unknown[]).forEach(walk); return; }
    const obj = v as Record<string, unknown>;

    if (typeof obj.id === "string") {
      // Try every known place Composio puts the from/subject
      const rawHeaders = parseHeaders(obj.headers ?? (obj.payload as Record<string, unknown> | undefined));
      const from =
        String(obj.from ?? obj.From ?? rawHeaders.from ?? rawHeaders.From ?? "")
        || "Unknown";
      const subject =
        String(obj.subject ?? obj.Subject ?? rawHeaders.subject ?? rawHeaders.Subject ?? "(no subject)");
      const date =
        String(obj.date ?? rawHeaders.date ?? obj.internalDate ?? "");
      const snippet = String(obj.snippet ?? obj.body ?? "").slice(0, 200);

      if (subject !== "(no subject)" || from !== "Unknown") {
        items.push({
          id: obj.id as string,
          threadId: typeof obj.threadId === "string" ? obj.threadId : undefined,
          from,
          subject,
          date,
          snippet,
        });
      }
    }
    // Walk nested objects but skip bulky payload
    for (const [k, val] of Object.entries(obj)) {
      if (k === "raw" || k === "attachmentList") continue;
      walk(val);
    }
  }

  walk(data);

  // Deduplicate by id, keep first 10
  const seen = new Set<string>();
  return items.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  }).slice(0, 10);
}

// ─── Direct tool executor ─────────────────────────────────────────────────────
async function directExecute(
  slug: string,
  args: Record<string, unknown>,
  uid: string,
): Promise<{ data: unknown; error: string | null }> {
  if (slug === FOOTBALL_SLUG) {
    try { return { data: await footballScores(args), error: null }; }
    catch (e) { return { data: null, error: e instanceof Error ? e.message : "football data unavailable" }; }
  }
  try {
    const session = await userSession(uid);
    const res = await session.execute(slug, normalizeArgs(slug, args));
    return { data: res.data, error: res.error ?? null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "tool failed" };
  }
}

// ─── Memory op processor (runs after a reply is generated) ───────────────────
async function processMemoryOps(
  rawText: string,
  uid: string,
  idToken: string,
): Promise<{ cleanText: string; opsApplied: number }> {
  const ops = parseMemoryOps(rawText);
  const cleanText = stripMemoryTags(rawText);
  if (!ops.length) return { cleanText, opsApplied: 0 };

  try {
    const store = await readMemoryStore(uid, idToken);
    const { store: updated, applied } = applyMemoryOps(store, ops);
    if (applied.length) {
      await writeMemoryStore(uid, idToken, updated);
      log("memory", `${applied.length} op(s) — facts total: ${updated.facts.length}`);
    }
    return { cleanText, opsApplied: applied.length };
  } catch {
    return { cleanText, opsApplied: 0 };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = idToken ? await verifyToken(idToken) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    messages?: unknown;
    timezone?: unknown;
    connected?: unknown;         // services connected RIGHT NOW
    firstMessage?: unknown;      // true = include full system context in this call
    pinnedTools?: unknown;       // tool slugs that were unlocked mid-conversation and must stay
    defaultReminderTime?: unknown;
    personality?: unknown;
    cid?: unknown;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  let messages: Msg[] = raw
    .slice(-6)
    .filter((m): m is Msg => !!m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map((m) => ({ role: m.role, text: m.text.slice(0, 800) }));
  while (messages.length && messages[0].role !== "user") messages = messages.slice(1);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const timezone = typeof body.timezone === "string" && body.timezone.length < 60 ? body.timezone : "Africa/Lagos";
  const connected = Array.isArray(body.connected) ? (body.connected as string[]).filter((s) => typeof s === "string") : [];
  const isFirstMessage = body.firstMessage === true;
  // Pinned tools are slugs unlocked mid-conversation that must always stay in context
  const pinnedTools = Array.isArray(body.pinnedTools) ? (body.pinnedTools as string[]).filter((s) => typeof s === "string") : [];
  const defaultReminderTime = typeof body.defaultReminderTime === "string" ? body.defaultReminderTime : "8:00 AM";
  const personality: PersonalityKey = typeof body.personality === "string" && body.personality in PERSONALITIES ? (body.personality as PersonalityKey) : DEFAULT_PERSONALITY;
  const cid = typeof body.cid === "string" && body.cid.length < 100 ? body.cid : "unknown";

  // Blocked users cost us nothing — checked before any AI call is made.
  const usage = await checkUsage(user.uid, cid, idToken, timezone).catch(() => ({ dailyTokens: 0, conversationTokens: 0, blocked: false as const }));
  if (usage.blocked) {
    return NextResponse.json({ reply: limitMessage(usage.blocked), provider: "limit" });
  }

  // Load memory only on first message (it was injected into context already for subsequent ones)
  const store = isFirstMessage
    ? await readMemoryStore(user.uid, idToken).catch(() => ({ facts: [] }))
    : { facts: [] };
  const memory = isFirstMessage ? memoryBlock(store) : "";

  // ── Router call ──
  let decision: RouteDecision | null = null;
  let memoryPartFromRouter = "";
  let routerTokens = { input: 0, output: 0 };

  try {
    const { text, inputTokens, outputTokens } = await callAI(
      routerPrompt(user.name, timezone, connected, memory, isFirstMessage, pinnedTools, defaultReminderTime, personality),
      messages,
      false, // NOT json mode — we need free text after the JSON block for memory tags
    );
    routerTokens = { input: inputTokens, output: outputTokens };
    const parsed = parseRouterReply(text);
    decision = parsed.decision;
    memoryPartFromRouter = parsed.memoryPart;
  } catch (e) {
    console.error("router failed:", e instanceof Error ? e.message : "unknown");
  }

  // Process any memory tags the router wrote
  if (memoryPartFromRouter.trim()) {
    const ops = parseMemoryOps(memoryPartFromRouter);
    if (ops.length) {
      try {
        const fresh = await readMemoryStore(user.uid, idToken);
        const { store: updated, applied } = applyMemoryOps(fresh, ops);
        if (applied.length) {
          await writeMemoryStore(user.uid, idToken, updated);
          log("memory", `router wrote ${applied.length} fact(s) — total: ${updated.facts.length}`);
        }
      } catch { /* best-effort */ }
    }
  }

  // ── Direct answer (small talk only) ──
  // ONLY pure conversational replies go here. Anything with tools goes to the agent.
  if (decision?.kind === "answer") {
    const { cleanText, opsApplied } = await processMemoryOps(decision.reply, user.uid, idToken);
    log("chat", `direct-answer${opsApplied ? ` +memory(${opsApplied})` : ""}`, { router: routerTokens.input + routerTokens.output });
    await recordUsage(user.uid, cid, idToken, timezone, routerTokens.input + routerTokens.output).catch(() => {});
    return NextResponse.json({ reply: stripMarkdown(cleanText), provider: "router" });
  }

  // Everything else (need_info, connect, tools, fallback) → send to agent
  // The agent has the full context, knows what services are connected, and handles
  // multi-turn conversations correctly. Don't try to handle it here.
  if (decision?.kind === "need_info" || decision?.kind === "connect" || decision?.kind === "tools" || !decision) {
    log("chat", `→ agent (${decision?.kind ?? "fallback"})`, { router: routerTokens.input + routerTokens.output });
    await recordUsage(user.uid, cid, idToken, timezone, routerTokens.input + routerTokens.output).catch(() => {});
    return NextResponse.json({ toAgent: true, provider: "router" });
  }

  // ── Fallback answer ──
  try {
    const { text: rawReply, inputTokens, outputTokens } = await callAI(answerPrompt(user.name, timezone, memory), messages);
    const { cleanText, opsApplied } = await processMemoryOps(rawReply, user.uid, idToken);
    log("chat", `fallback${opsApplied ? ` +memory(${opsApplied})` : ""}`, { fallback: inputTokens + outputTokens });
    await recordUsage(user.uid, cid, idToken, timezone, routerTokens.input + routerTokens.output + inputTokens + outputTokens).catch(() => {});
    return NextResponse.json({ reply: cleanText, provider: "fallback" });
  } catch {
    // Every key in the normal rotation just failed. One last, honest try before
    // giving up entirely — plain chat only, no tools, using the reserved key.
    try {
      const reply = await lastResortReply(messages[messages.length - 1].text);
      await recordUsage(user.uid, cid, idToken, timezone, routerTokens.input + routerTokens.output).catch(() => {});
      return NextResponse.json({ reply, provider: "reserve" });
    } catch {
      return NextResponse.json({ error: "ai unavailable" }, { status: 502 });
    }
  }
}