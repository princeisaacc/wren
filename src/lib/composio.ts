import { Composio } from "@composio/core";
import type { ServiceKey } from "@/lib/services";

export const toolkitSlug: Record<ServiceKey, string> = {
  calendar: "googlecalendar",
  tasks: "googletasks",
  gmail: "gmail",
  drive: "googledrive",
};

let client: Composio | null = null;

export function getComposio() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is missing");
  client ??= new Composio({ apiKey });
  return client;
}

// The Firebase uid is the Composio user id, so every connection belongs to exactly one Wren user.
export function userSession(uid: string, callbackUrl?: string) {
  return getComposio().create(uid, {
    toolkits: [...Object.values(toolkitSlug), "composio_search"],
    manageConnections: callbackUrl ? { callbackUrl } : false,
  });
}

export function isService(value: unknown): value is ServiceKey {
  return typeof value === "string" && value in toolkitSlug;
}