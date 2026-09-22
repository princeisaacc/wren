import { verifyRequest } from "@/lib/server-auth";
import { userSession } from "@/lib/composio";
import { bySlug } from "@/lib/agent-tools";
import { services } from "@/lib/services";

export const runtime = "nodejs";
export const maxDuration = 30;

function findLink(value: unknown, depth = 0): string | null {
  if (depth > 5 || value == null) return null;
  if (typeof value === "string") {
    return /^https:\/\/(calendar|mail|docs|drive|tasks)\.google\.com\//.test(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findLink(v, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = findLink(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { tool?: unknown; args?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const info = typeof body.tool === "string" ? bySlug[body.tool] : undefined;
  if (!info || !info.write || !body.args || typeof body.args !== "object" || Array.isArray(body.args)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { wren_summary: _summary, ...args } = body.args as Record<string, unknown>;
  void _summary;

  try {
    const session = await userSession(user.uid);
    const res = await session.execute(info.slug, args);
    if (res.error) {
      console.error("action failed:", info.slug, String(res.error).slice(0, 200));
      return Response.json({ ok: false, error: String(res.error).slice(0, 300) });
    }
    const link = findLink(res.data);
    return Response.json({
      ok: true,
      text: info.done ?? "Done.",
      ...(link ? { link, linkLabel: services[info.service!].openLabel } : {}),
    });
  } catch (e) {
    console.error("action crashed:", info.slug, e instanceof Error ? e.message : "unknown");
    return Response.json({ ok: false, error: "Could not reach the service." }, { status: 502 });
  }
}