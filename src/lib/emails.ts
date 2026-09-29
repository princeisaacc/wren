/**
 * Pulls a clean list of emails out of the raw Gmail tool result, so the chat
 * can show tappable email cards. Shared by the agent route (server-side only).
 */

export type EmailItem = { id: string; threadId?: string; from: string; subject: string; date?: string; snippet?: string };

export function extractEmails(data: unknown): EmailItem[] {
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

    // Composio has used different field names over time (id/messageId, from/sender), so accept both.
    const msgId =
      typeof obj.id === "string" ? obj.id
      : typeof obj.messageId === "string" ? obj.messageId
      : typeof obj.message_id === "string" ? obj.message_id
      : undefined;
    const preview = (obj.preview && typeof obj.preview === "object" ? obj.preview : {}) as Record<string, unknown>;

    if (msgId) {
      // Try every known place Composio puts the from/subject
      const rawHeaders = parseHeaders(obj.headers ?? (obj.payload as Record<string, unknown> | undefined));
      const from =
        String(obj.from ?? obj.From ?? obj.sender ?? rawHeaders.from ?? rawHeaders.From ?? "")
        || "Unknown";
      const subject =
        String(obj.subject ?? obj.Subject ?? rawHeaders.subject ?? rawHeaders.Subject ?? preview.subject ?? "(no subject)");
      const date =
        String(obj.date ?? rawHeaders.date ?? obj.messageTimestamp ?? obj.internalDate ?? "");
      const snippet = String(obj.snippet ?? preview.body ?? obj.messageText ?? obj.body ?? "").slice(0, 200);

      if (subject !== "(no subject)" || from !== "Unknown") {
        items.push({
          id: msgId,
          threadId: typeof obj.threadId === "string" ? obj.threadId : typeof obj.thread_id === "string" ? obj.thread_id : undefined,
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