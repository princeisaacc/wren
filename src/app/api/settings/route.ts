/**
 * /api/settings
 *
 * GET  — returns the user's saved settings (timezone, default reminder time,
 *        ask-before-changes), or the defaults if nothing has been saved yet.
 * POST — saves the settings the user changed on the Settings page.
 */

import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/server-auth";
import { readSettings, writeSettings, DEFAULT_SETTINGS, PERSONALITIES, type UserSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 10;

function idToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await readSettings(user.uid, idToken(req));
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Partial<UserSettings>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const current = await readSettings(user.uid, idToken(req));
  const next: UserSettings = {
    timezone: typeof body.timezone === "string" && body.timezone.length < 60 ? body.timezone : current.timezone,
    defaultReminderTime: typeof body.defaultReminderTime === "string" ? body.defaultReminderTime : current.defaultReminderTime,
    askBeforeChanges: typeof body.askBeforeChanges === "boolean" ? body.askBeforeChanges : current.askBeforeChanges,
    personality: typeof body.personality === "string" && body.personality in PERSONALITIES ? body.personality : current.personality,
  };

  const ok = await writeSettings(user.uid, idToken(req), next);
  if (!ok) return NextResponse.json({ error: "could not save" }, { status: 502 });
  return NextResponse.json({ settings: next });
}