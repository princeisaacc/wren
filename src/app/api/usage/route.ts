/**
 * /api/usage
 *
 * GET ?tz=Africa/Lagos — returns today's token usage and the limits, for the
 * circle tracker on the Settings page. Read-only; never spends any tokens.
 */

import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/server-auth";
import { checkUsage, DAILY_TOKEN_LIMIT, CONVERSATION_TOKEN_LIMIT } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const header = req.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const tzParam = new URL(req.url).searchParams.get("tz") ?? "Africa/Lagos";
  let tz = tzParam.length < 60 ? tzParam : "Africa/Lagos";
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); } catch { tz = "Africa/Lagos"; }

  // cid "none" -> no conversation doc exists, so conversation usage reads as 0; we only need the daily figure here.
  const status = await checkUsage(user.uid, "none", idToken, tz);
  return NextResponse.json({
    dailyTokens: status.dailyTokens,
    dailyLimit: DAILY_TOKEN_LIMIT,
    conversationLimit: CONVERSATION_TOKEN_LIMIT,
  });
}