import type { Content } from "@/lib/agent";

export type Decl = { name: string; description: string; parameters?: Record<string, unknown> };

export function toOpenAIMessages(system: string, contents: Content[]) {
  const messages: Record<string, unknown>[] = [{ role: "system", content: system }];
  for (const c of contents) {
    if (c.role === "model") {
      const text = c.parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
      const calls = c.parts.filter((p) => p.functionCall);
      messages.push({
        role: "assistant",
        content: text || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((p, i) => ({
                id: String(p.callId ?? `call_${i}`),
                type: "function",
                function: { name: p.functionCall!.name, arguments: JSON.stringify(p.functionCall!.args ?? {}) },
              })),
            }
          : {}),
      });
      continue;
    }
    const responses = c.parts.filter((p) => p.functionResponse);
    if (responses.length) {
      for (const p of responses) {
        messages.push({
          role: "tool",
          tool_call_id: String(p.callId ?? ""),
          content: JSON.stringify(p.functionResponse!.response).slice(0, 8000),
        });
      }
    } else {
      messages.push({ role: "user", content: c.parts.map((p) => p.text ?? "").join("") });
    }
  }
  return messages;
}

export async function callGroqAgent(
  system: string,
  contents: Content[],
  declarations: Decl[],
  opts?: { noTools?: boolean },
): Promise<Content> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no groq key");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: toOpenAIMessages(system, contents),
      tools: declarations.map((d) => ({
        type: "function",
        function: { name: d.name, description: d.description, parameters: d.parameters ?? { type: "object", properties: {} } },
      })),
      tool_choice: opts?.noTools ? "none" : "auto",
      max_tokens: 1500, 
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error("groq empty");
  const finish = data?.choices?.[0]?.finish_reason;
  if (finish && finish !== "stop" && finish !== "tool_calls") throw new Error(`groq stopped early: ${finish}`);

  const parts: Content["parts"] = [];
  if (typeof message.content === "string" && message.content.trim()) parts.push({ text: message.content });
  for (const tc of message.tool_calls ?? []) {
    let args: Record<string, unknown> = {};
    try {
      args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
    } catch {
      throw new Error("groq sent broken tool arguments");
    }
    parts.push({ functionCall: { name: String(tc.function?.name), args }, callId: String(tc.id) });
  }
  if (!parts.length) throw new Error("groq empty");
  return { role: "model", parts };
}