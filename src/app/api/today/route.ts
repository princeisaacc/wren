import { verifyRequest } from "@/lib/server-auth";
import { loadToday } from "@/lib/today";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  const today = url.searchParams.get("today") ?? "";
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  try {
    return Response.json(await loadToday(user.uid, { start, end, today }));
  } catch (e) {
    console.error("today failed:", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}