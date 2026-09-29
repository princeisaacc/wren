/**
 * Multi-key provider rotation.
 *
 * Normal rotation tries, in order:
 *   groq(key1) -> gemini(key1) -> groq(key2) -> gemini(key2) -> groq(key3)
 *
 * GEMINI_API_KEY_3 is deliberately left OUT of that list — it's reserved as
 * the last-resort responder (see lastResortReply below), used only when every
 * key above has failed on this request. It never takes a turn in the normal
 * rotation, so it's never rate-limited by ordinary use.
 *
 * Any key slot that isn't set is just skipped — this works fine with 1, 2, or
 * 3 real Groq keys and 1 or 2 real Gemini keys configured.
 */

export type Provider = "groq" | "gemini";

export type KeyedAttempt = {
  provider: Provider;
  key: string;
  // Stable id per (provider, key) pair, for the caller's own "skip this one
  // for the rest of this request" tracking — e.g. "groq:2" for the 2nd groq key.
  id: string;
};

function groqKeys(): string[] {
  return [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(
    (k): k is string => Boolean(k && k.trim()),
  );
}

// Only the first 2 Gemini keys are part of normal rotation — key 3 is reserved.
function geminiRotationKeys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter((k): k is string => Boolean(k && k.trim()));
}

export function buildAttempts(): KeyedAttempt[] {
  const groq = groqKeys();
  const gemini = geminiRotationKeys();
  const first: Provider = process.env.AI_PRIMARY === "gemini" ? "gemini" : "groq";
  const second: Provider = first === "groq" ? "gemini" : "groq";
  const firstKeys = first === "groq" ? groq : gemini;
  const secondKeys = first === "groq" ? gemini : groq;

  const attempts: KeyedAttempt[] = [];
  const rounds = Math.max(firstKeys.length, secondKeys.length);
  for (let i = 0; i < rounds; i++) {
    if (firstKeys[i]) attempts.push({ provider: first, key: firstKeys[i], id: `${first}:${i + 1}` });
    if (secondKeys[i]) attempts.push({ provider: second, key: secondKeys[i], id: `${second}:${i + 1}` });
  }
  return attempts;
}

/**
 * Last resort: called only when every key in buildAttempts() has already
 * failed for this one request. Deliberately does NOT attempt any tool/agent
 * work — it makes one plain, no-tools Gemini call (using the reserved 3rd
 * Gemini key) whose only job is to honestly tell the user Wren hit a technical
 * problem, rather than leaving them with silence or a hard error.
 *
 * The next message the user sends starts a fresh request and goes through
 * buildAttempts() from the top again (groq key 1 first) — this reserved key
 * is never "stuck on" past the one message it rescued.
 */
export async function lastResortReply(userText: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY_3;
  if (!key || !key.trim()) throw new Error("no reserve key configured");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text:
            "You are Wren. Every attempt to process this request just failed due to a technical problem " +
            "(rate limits or a provider outage) — you were not able to actually do anything the user asked. " +
            "Reply with one short, honest, friendly sentence acknowledging that and suggesting they try again " +
            "shortly. Do not claim to have completed, checked, or looked at anything. Do not attempt to describe " +
            "calendar, email, task, or Drive results — you have none.",
        }],
      },
      contents: [{ role: "user", parts: [{ text: userText.slice(0, 800) }] }],
      generationConfig: { maxOutputTokens: 120, temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`gemini-reserve ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const u = data?.usageMetadata;
  if (u) console.log(`[WREN] agent-model → gemini-reserve | prompt:${u.promptTokenCount ?? 0}tok output:${u.candidatesTokenCount ?? 0}tok total:${u.totalTokenCount ?? 0}tok`);
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw new Error("gemini-reserve empty response");
  return text;
}