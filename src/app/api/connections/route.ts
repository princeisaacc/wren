import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/server-auth";
import { toolkitSlug, userSession } from "@/lib/composio";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const session = await userSession(user.uid);
    const res = await session.toolkits({ toolkits: Object.values(toolkitSlug) });
    const connected: Record<string, boolean> = {};
    for (const [key, slug] of Object.entries(toolkitSlug)) {
      connected[key] = !!res.items.find((i) => i.slug === slug)?.connection?.isActive;
    }
    return NextResponse.json({ connected });
  } catch (e) {
    console.error("connections status failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}