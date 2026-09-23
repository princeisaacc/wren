/**
 * /api/memory
 *
 * GET  — returns the user's memory facts (for the settings page)
 * POST — settings-page edit: user describes what's wrong, AI fixes the store
 * DELETE ?id=f3 — removes one fact directly
 */

import { NextResponse } from "next/server";
import {
  readMemoryStore,
  writeMemoryStore,
  applyMemoryOps,
  parseMemoryOps,
  memoryBlock,
} from "@/lib/memory";

export const runtime = "nodejs";
export const maxDuration = 20;

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

async function callAI(system: string, userText: string): Promise<string> {
  const order = process.env.AI_PRIMARY === "gemini"
    ? (["gemini", "groq"] as const)
    : (["groq", "gemini"] as const);
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
            max_tokens: 600,
            ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
            messages: [{ role: "system", content: system }, { role: "user", content: userText }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`groq ${res.status}`);
        const data = await res.json();
        return String(data?.choices?.[0]?.message?.content ?? "").trim();
      } else {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("no gemini key");
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: userText }] }],
              generationConfig: {
                maxOutputTokens: 600,
                ...(model.includes("2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
              },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!res.ok) throw new Error(`gemini ${res.status}`);
        const data = await res.json();
        const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
        return parts.map((p) => p.text ?? "").join("").trim();
      }
    } catch (e) {
      console.error(`memory-api ${provider} failed:`, e instanceof Error ? e.message : "unknown");
    }
  }
  return "";
}

function bearer(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

// ─── GET: return facts for the settings page ──────────────────────────────────
export async function GET(req: Request) {
  const token = bearer(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const store = await readMemoryStore(user.uid, token);
  return NextResponse.json({ facts: store.facts });
}

// ─── POST: user tells us what's wrong, AI fixes it ───────────────────────────
export async function POST(req: Request) {
  const token = bearer(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { instruction?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const instruction = typeof body.instruction === "string" ? body.instruction.slice(0, 500) : "";
  if (!instruction) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const store = await readMemoryStore(user.uid, token);
  const currentBlock = memoryBlock(store) || "(no facts yet)";

  const system = `You manage a user's personal memory for an AI assistant called Wren.

Current facts:
${currentBlock}

The user wants to correct or remove something. Apply the minimum number of changes needed.
Reply ONLY with memory operation tags, nothing else:
- [[remember: new fact here]]
- [[update: f3 → corrected fact here]]
- [[forget: f3]]

Use the fact ids shown above. If nothing needs changing, reply with NO_CHANGE.`;

  const result = await callAI(system, instruction);

  if (!result || result.trim() === "NO_CHANGE") {
    return NextResponse.json({ updated: false, facts: store.facts });
  }

  const ops = parseMemoryOps(result);
  if (!ops.length) return NextResponse.json({ updated: false, facts: store.facts });

  const { store: updated, applied } = applyMemoryOps(store, ops);
  await writeMemoryStore(user.uid, token, updated);

  console.log(`[WREN] memory-api → user edit: ${applied.length} op(s) applied`);

  return NextResponse.json({ updated: true, applied: applied.length, facts: updated.facts });
}

// ─── DELETE: remove one fact by id ────────────────────────────────────────────
export async function DELETE(req: Request) {
  const token = bearer(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const store = await readMemoryStore(user.uid, token);
  const before = store.facts.length;
  const updated = { facts: store.facts.filter((f) => f.id !== id) };
  if (updated.facts.length === before) return NextResponse.json({ deleted: false, facts: store.facts });

  await writeMemoryStore(user.uid, token, updated);
  console.log(`[WREN] memory-api → deleted fact ${id}`);
  return NextResponse.json({ deleted: true, facts: updated.facts });
}