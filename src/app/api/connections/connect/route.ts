import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/server-auth";
import { isService, toolkitSlug, userSession } from "@/lib/composio";

export const runtime = "nodejs";

const allowedReturn = ["/connections", "/onboarding", "/today", "/chat"];

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { service?: unknown; returnTo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!isService(body.service)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const returnTo = typeof body.returnTo === "string" && allowedReturn.includes(body.returnTo) ? body.returnTo : "/connections";
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const callbackUrl = `${origin}${returnTo}`;

  try {
    const session = await userSession(user.uid, callbackUrl);
    const request = await session.authorize(toolkitSlug[body.service], { callbackUrl });
    if (!request.redirectUrl) throw new Error("no redirect url");
    return NextResponse.json({ url: request.redirectUrl });
  } catch (e) {
    console.error("connect failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}