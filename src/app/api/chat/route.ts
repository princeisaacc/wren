import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Msg = { role: "user" | "assistant"; text: string };

// The exact list of tools the agent can call, with argument shapes the router can fill.
const ROUTABLE_TOOLS = [
  { slug: "GOOGLECALENDAR_EVENTS_LIST", service: "calendar", description: "List calendar events. Use for: show/check calendar, what's on today/this week/tomorrow." },
  { slug: "GOOGLECALENDAR_FIND_FREE_SLOTS", service: "calendar", description: "Find free time slots. Use for: when am I free, find a gap, check availability." },
  { slug: "GOOGLECALENDAR_CREATE_EVENT", service: "calendar", write: true, description: "Create a calendar event. Required args: summary (title), start_datetime (ISO), end_datetime (ISO), timezone. Use for: add/schedule/create a meeting or event." },
  { slug: "GOOGLECALENDAR_PATCH_EVENT", service: "calendar", write: true, description: "Update an existing event. Use for: change/move/reschedule/rename an event." },
  { slug: "GOOGLECALENDAR_DELETE_EVENT", service: "calendar", write: true, description: "Delete an event. Use for: remove/cancel/delete an event." },
  { slug: "GOOGLETASKS_LIST_ALL_TASKS", service: "tasks", description: "List all tasks. Use for: show tasks, what do I have to do, any reminders." },
  { slug: "GOOGLETASKS_INSERT_TASK", service: "tasks", write: true, description: "Create a task. Required args: title, due (ISO date). Use for: add/create a task or reminder without a specific time." },
  { slug: "GOOGLETASKS_PATCH_TASK", service: "tasks", write: true, description: "Update a task. Use for: mark done, rename, change due date." },
  { slug: "GOOGLETASKS_DELETE_TASK", service: "tasks", write: true, description: "Delete a task. Use for: remove/delete a task." },
  { slug: "GMAIL_FETCH_EMAILS", service: "gmail", description: "Search emails. Required args: max_results (number, default 5). Use for: show/check/read emails, inbox, latest messages." },
  { slug: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID", service: "gmail", description: "Read one full email. Required args: message_id. Use for: open/read a specific email." },
  { slug: "GMAIL_SEND_EMAIL", service: "gmail", write: true, description: "Send an email. Required args: recipient_email, subject, body. Use for: send/write an email." },
  { slug: "GMAIL_REPLY_TO_THREAD", service: "gmail", write: true, description: "Reply to an email thread. Required args: thread_id, recipient_email, message_body. Use for: reply to an email." },
  { slug: "GMAIL_CREATE_EMAIL_DRAFT", service: "gmail", write: true, description: "Save an email as draft. Required args: recipient_email, subject, body. Use for: draft/save an email." },
  { slug: "GOOGLEDRIVE_FIND_FILE", service: "drive", description: "Find files or folders. Required args: query (partial name). Use for: find/search files, look for a document." },
  { slug: "GOOGLEDRIVE_GET_DOCUMENT", service: "drive", description: "Read a Google Doc. Required args: document_id. Use for: read/open/summarise a Google Doc." },
  { slug: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", service: "drive", write: true, description: "Create a text file in Drive. Required args: file_name, content. Use for: create/save a file in Drive." },
  { slug: "COMPOSIO_SEARCH_DUCK_DUCK_GO_SEARCH", description: "Search the web. Required args: query. Use for: web search, current info, prices, rates, facts." },
  { slug: "COMPOSIO_SEARCH_NEWS_SEARCH", description: "Search news. Required args: query. Use for: news, headlines, recent events." },
  { slug: "COMPOSIO_SEARCH_FINANCE_SEARCH", description: "Market data. Required args: query. Use for: stock prices, exchange rates like naira to dollar." },
  { slug: "COMPOSIO_SEARCH_FETCH_URL_CONTENT", description: "Read a web page. Required args: url. Use for: open a link from search results." },
  { slug: "WREN_FOOTBALL_SCORES", description: "Football scores and fixtures. Optional args: date (YYYYMMDD or range), team, league. Use for: football results, scores, fixtures, match info." },
] as const;

type ToolSlug = typeof ROUTABLE_TOOLS[number]["slug"];
type RouteDecision =
  | { kind: "answer"; reply: string }
  | { kind: "need_info"; question: string }
  | { kind: "tools"; tools: { slug: ToolSlug; args: Record<string, unknown> }[] };

async function verifyToken(token: string) {
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

function routerPrompt(name: string, timezone: string, connected: string[]) {
  const now = new Date().toLocaleString("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "short" });
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date()).replace(/-/g, "");
  const toolList = ROUTABLE_TOOLS
    .filter((t) => !("service" in t) || !(t as { service?: string }).service || connected.includes((t as { service?: string }).service!))
    .map((t) => `- ${t.slug}: ${t.description}`)
    .join("\n");
  return `You are Wren's router. You read the conversation and decide what to do next. Reply ONLY with valid JSON, no markdown, no explanation.

User: ${name || "unknown"}. Now: ${now} (${timezone}). Today YYYYMMDD: ${ymd}.
Connected Google services: ${connected.length ? connected.join(", ") : "none"}.

Available tools:
${toolList}

Rules:
1. If the message is a greeting, thanks, small talk, general question, or anything that needs no data from the user's accounts or the web, reply with: {"kind":"answer","reply":"your short friendly reply here"}
2. If a tool is needed but a required argument is missing and you cannot infer it from the conversation, reply with: {"kind":"need_info","question":"the one short question to ask"}
3. Otherwise reply with: {"kind":"tools","tools":[{"slug":"TOOL_SLUG","args":{"arg":"value"}}]}

Tool rules:
- Only include tools that are directly needed. Never include all tools.
- For emails: max_results defaults to 5 unless the user specifies a number.
- For calendar events: infer the date from context and today's date. Assume 1 hour duration if not given.
- For reminders at a specific time: use GOOGLECALENDAR_CREATE_EVENT not a task.
- For web questions (prices, news, rates, current events): use the web search tools even if no service is connected.
- For football: use WREN_FOOTBALL_SCORES with a date range of the last 14 days to find recent results.
- A write tool (create, send, delete, patch) still goes in the tools array. The agent will show a confirm card before acting.
- Never put args you do not know. Leave them out and the agent will fill them in.`;
}

function answerPrompt(name: string, timezone: string) {
  const now = new Date().toLocaleString("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "short" });
  return [
    "You are Wren, a personal assistant inside the Wren app.",
    name ? `The user's name is ${name}.` : "",
    `The current date and time for the user is ${now} (${timezone}).`,
    "The user is often a student or young professional in Nigeria.",
    "In this reply you cannot use the user's Google Calendar, Tasks, Gmail or Drive.",
    "Write short, clear, friendly replies in plain text. No markdown, no em dashes.",
  ].filter(Boolean).join(" ");
}

async function callAI(system: string, messages: Msg[], json = false): Promise<string> {
  const order = process.env.AI_PRIMARY === "gemini" ? (["gemini", "groq"] as const) : (["groq", "gemini"] as const);
  for (const provider of order) {
    try {
      if (provider === "groq") {
        const key = process.env.GROQ_API_KEY;
        if (!key) throw new Error("no groq key");
        const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            max_tokens: json ? 400 : 600,
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
        return text;
      } else {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("no gemini key");
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
            generationConfig: {
              maxOutputTokens: json ? 400 : 600,
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
        return text;
      }
    } catch (e) {
      console.error(`${provider} failed:`, e instanceof Error ? e.message : "unknown");
    }
  }
  throw new Error("all providers failed");
}

function parseDecision(raw: string): RouteDecision | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const d = JSON.parse(cleaned);
    if (d.kind === "answer" && typeof d.reply === "string") return d as RouteDecision;
    if (d.kind === "need_info" && typeof d.question === "string") return d as RouteDecision;
    if (d.kind === "tools" && Array.isArray(d.tools) && d.tools.length > 0) return d as RouteDecision;
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { messages?: unknown; timezone?: unknown; connected?: unknown };
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

  let decision: RouteDecision | null = null;
  try {
    const routerReply = await callAI(routerPrompt(user.name, timezone, connected), messages, true);
    decision = parseDecision(routerReply);
  } catch (e) {
    console.error("router failed:", e instanceof Error ? e.message : "unknown");
  }

  if (decision?.kind === "answer") return NextResponse.json({ reply: decision.reply, provider: "router" });
  if (decision?.kind === "need_info") return NextResponse.json({ reply: decision.question, provider: "router" });
  if (decision?.kind === "tools") return NextResponse.json({ tools: decision.tools, provider: "router" });

  try {
    const reply = await callAI(answerPrompt(user.name, timezone), messages);
    return NextResponse.json({ reply, provider: "fallback" });
  } catch {
    return NextResponse.json({ error: "ai unavailable" }, { status: 502 });
  }
}