import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/server-auth";
import { getComposio, isService, toolkitSlug, userSession } from "@/lib/composio";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { service?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!isService(body.service)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    const slug = toolkitSlug[body.service];
    // Looked up through this user's own session, so nobody can remove another user's connection.
    const session = await userSession(user.uid);
    const res = await session.toolkits({ toolkits: [slug] });
    const id = res.items.find((i) => i.slug === slug)?.connection?.connectedAccount?.id;
    if (id) await getComposio().connectedAccounts.delete(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("disconnect failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}