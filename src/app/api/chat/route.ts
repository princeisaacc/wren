import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Msg = { role: "user" | "assistant"; text: string };

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

function systemPrompt(name: string, timezone: string) {
  const now = new Date().toLocaleString("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "short" });
  return [
    "You are Wren, a personal assistant inside the Wren app.",
    name ? `The user's name is ${name}.` : "",
    `The current date and time for the user is ${now} (${timezone}).`,
    "The user is often a student or young professional in Nigeria.",
    "In this reply you cannot use the user's Google Calendar, Tasks, Gmail or Drive. Wren normally can, when the user asks for a specific action.",
    "If the user asks for something that needs those services, tell them briefly to ask it again as a clear request, and offer to help in chat meanwhile.",
    "Never claim you added, sent, changed or found anything in their accounts.",
    "Write short, clear, friendly replies in plain text. Do not use markdown symbols, headings or em dashes.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function callGemini(system: string, messages: Msg[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no gemini key");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
      generationConfig: { maxOutputTokens: 1200 },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("gemini empty");
  return text;
}

async function callGroq(system: string, messages: Msg[]) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no groq key");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.text }))],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("groq empty");
  return text;
}

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { messages?: unknown; timezone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  let messages: Msg[] = raw
    .slice(-20)
    .filter((m): m is Msg => !!m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
  while (messages.length && messages[0].role !== "user") messages = messages.slice(1);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const timezone = typeof body.timezone === "string" && body.timezone.length < 60 ? body.timezone : "Africa/Lagos";
  let system: string;
  try {
    system = systemPrompt(user.name, timezone);
  } catch {
    system = systemPrompt(user.name, "Africa/Lagos");
  }

  const order = process.env.AI_PRIMARY === "gemini" ? (["gemini", "groq"] as const) : (["groq", "gemini"] as const);
  for (const provider of order) {
    try {
      const reply = provider === "groq" ? await callGroq(system, messages) : await callGemini(system, messages);
      return NextResponse.json({ reply, provider });
    } catch (e) {
      console.error(`${provider} failed:`, e instanceof Error ? e.message : "unknown");
    }
  }
  return NextResponse.json({ error: "ai unavailable" }, { status: 502 });
}