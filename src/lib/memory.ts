/**
 * Wren Memory — server-side only.
 *
 * Memory is stored as a JSON array of facts at:
 *   /users/{uid}/memory/profile  →  { facts: MemoryFact[] }
 *
 * The AI can write memory tags inline in its reply:
 *   [[remember: user dislikes swimming]]
 *   [[update: f3 → user's favourite food is spag, not rice]]
 *   [[forget: f3]]
 *
 * These tags are parsed out, applied to the stored facts, stripped from
 * the reply text before it reaches the user, and logged to the terminal.
 *
 * Facts are injected into the router system prompt so Wren already knows
 * the user before they say a word.
 */

export type MemoryFact = {
  id: string;       // e.g. "f1", "f12"
  fact: string;     // e.g. "Does not like swimming"
  source: "inferred" | "stated" | "corrected" | "user-edit";
  ts: number;       // unix ms
};

export type MemoryStore = { facts: MemoryFact[] };

const FIRESTORE_URL = (projectId: string, uid: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/memory/profile`;

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function readMemoryStore(uid: string, idToken: string): Promise<MemoryStore> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return { facts: [] };
  try {
    const res = await fetch(FIRESTORE_URL(projectId, uid), {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return { facts: [] };
    if (!res.ok) return { facts: [] };
    const doc = await res.json();
    const raw = doc?.fields?.facts?.stringValue;
    if (!raw) return { facts: [] };
    const parsed = JSON.parse(raw) as MemoryFact[];
    return { facts: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { facts: [] };
  }
}

export async function writeMemoryStore(uid: string, idToken: string, store: MemoryStore): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return;
  // Cap at 80 facts — drop oldest if over
  const facts = store.facts.slice(-80);
  try {
    await fetch(`${FIRESTORE_URL(projectId, uid)}?updateMask.fieldPaths=facts`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields: { facts: { stringValue: JSON.stringify(facts) } } }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort
  }
}

// ─── Fact helpers ─────────────────────────────────────────────────────────────

function newId(existing: MemoryFact[]): string {
  const max = existing.reduce((m, f) => {
    const n = parseInt(f.id.replace("f", ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `f${max + 1}`;
}

export function applyMemoryOps(
  store: MemoryStore,
  ops: MemoryOp[],
): { store: MemoryStore; applied: MemoryOp[] } {
  let facts = [...store.facts];
  const applied: MemoryOp[] = [];

  for (const op of ops) {
    if (op.type === "remember") {
      // Avoid near-duplicate facts (simple string similarity check)
      const lower = op.fact.toLowerCase();
      const dup = facts.some((f) => f.fact.toLowerCase() === lower);
      if (!dup) {
        facts.push({ id: newId(facts), fact: op.fact, source: "inferred", ts: Date.now() });
        applied.push(op);
      }
    } else if (op.type === "update") {
      const idx = facts.findIndex((f) => f.id === op.id);
      if (idx >= 0) {
        facts[idx] = { ...facts[idx], fact: op.newFact, source: "corrected", ts: Date.now() };
        applied.push(op);
      }
    } else if (op.type === "forget") {
      const before = facts.length;
      facts = facts.filter((f) => f.id !== op.id);
      if (facts.length < before) applied.push(op);
    }
  }

  return { store: { facts }, applied };
}

// ─── Tag parsing ──────────────────────────────────────────────────────────────

export type MemoryOp =
  | { type: "remember"; fact: string }
  | { type: "update"; id: string; newFact: string }
  | { type: "forget"; id: string };

const REMEMBER_RE = /\[\[remember:\s*(.+?)\]\]/gi;
const UPDATE_RE   = /\[\[update:\s*(f\d+)\s*→\s*(.+?)\]\]/gi;
const FORGET_RE   = /\[\[forget:\s*(f\d+)\]\]/gi;
// Also strip [[ids: ...]] and any other hidden tags the AI writes
const ANY_TAG_RE  = /\[\[(remember|update|forget|ids|data)[^\]]*\]\]/gi;

export function parseMemoryOps(text: string): MemoryOp[] {
  const ops: MemoryOp[] = [];
  for (const m of text.matchAll(REMEMBER_RE)) ops.push({ type: "remember", fact: m[1].trim() });
  for (const m of text.matchAll(UPDATE_RE))   ops.push({ type: "update", id: m[1].trim(), newFact: m[2].trim() });
  for (const m of text.matchAll(FORGET_RE))   ops.push({ type: "forget", id: m[1].trim() });
  return ops;
}

export function stripMemoryTags(text: string): string {
  return text.replace(ANY_TAG_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

/** A compact, human-readable list of facts for injecting into the router prompt. */
export function memoryBlock(store: MemoryStore): string {
  if (!store.facts.length) return "";
  const lines = store.facts.map((f) => `- [${f.id}] ${f.fact}`).join("\n");
  return `\nWhat you remember about this user (fact id in brackets — use it to update or forget):\n${lines}\n`;
}

/** Instructions appended to the system prompt explaining how to write memory tags. */
export const MEMORY_INSTRUCTIONS = `
MEMORY — check this every message:
After your reply, look at what the user just said. If it reveals something personal and long-term, write a memory tag on a new line. Tags are invisible to the user.

Tag format:
[[remember: <fact about the user in third person>]]
[[update: <factId> → <corrected fact>]]
[[forget: <factId>]]

Write a tag when the user reveals: their real name, course, university, job, city, food preferences, family, recurring schedule, habits, or long-term preferences.
Write an update tag when the user corrects something you already know (check the fact ids in the memory block above).
Never write tags for: one-off tasks, email contents, search results, things that change daily.
Never copy or repeat the examples above as real facts — only write tags for what THIS user actually said.`.trim();