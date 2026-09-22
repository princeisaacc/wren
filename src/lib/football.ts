import type { ToolInfo } from "@/lib/agent-tools";

// Real match data from ESPN's public scoreboard. It needs no account and no key.
export const FOOTBALL_SLUG = "WREN_FOOTBALL_SCORES";

export const footballInfo: ToolInfo = { slug: FOOTBALL_SLUG, write: false, step: "Checking football scores" };

export const footballDecl = {
  name: FOOTBALL_SLUG,
  description:
    "Get real football (soccer) results, live scores and fixtures with dates. Use this for any football score question instead of web search.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "A day as YYYYMMDD, or a range as YYYYMMDD-YYYYMMDD. Defaults to today. For a team's last match use the last 14 days.",
      },
      team: { type: "string", description: "Only matches involving this team, for example Chelsea." },
      league: {
        type: "string",
        description: "Optional league code: eng.1 Premier League, esp.1 La Liga, ita.1 Serie A, ger.1 Bundesliga, fra.1 Ligue 1, uefa.champions, uefa.europa.",
      },
    },
  },
};

type Match = { date: string; league: string; home: string; away: string; score: string; status: string };

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const MAJOR = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "uefa.champions", "uefa.europa", "uefa.europa.conf"];

/* eslint-disable @typescript-eslint/no-explicit-any */
async function board(league: string, dates: string): Promise<Match[]> {
  const res = await fetch(`${BASE}/${league}/scoreboard?dates=${dates}&limit=300`, {
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Mozilla/5.0 (Wren)" },
  });
  if (!res.ok) throw new Error(`espn ${res.status}`);
  const data: any = await res.json();
  const out: Match[] = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const state = ev.status?.type?.state;
    const detail = ev.status?.type?.shortDetail ?? ev.status?.type?.description ?? "";
    out.push({
      date: `${String(ev.date ?? "").slice(0, 16).replace("T", " ")} UTC`,
      league: ev.league?.name ?? data.leagues?.[0]?.name ?? league,
      home: home.team?.displayName ?? "Home",
      away: away.team?.displayName ?? "Away",
      score: state === "pre" ? "vs" : `${home.score ?? "-"}-${away.score ?? "-"}`,
      status: state === "post" ? "Full time" : state === "in" ? `Live, ${detail}` : `Not started (${detail})`,
    });
  }
  return out;
}

export async function footballScores(args: Record<string, unknown>) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dates = typeof args.date === "string" && /^\d{8}(-\d{8})?$/.test(args.date) ? args.date : today;
  const team = typeof args.team === "string" ? args.team.trim().toLowerCase() : "";
  const league = typeof args.league === "string" && /^[a-z0-9.]+$/i.test(args.league) ? args.league : "";

  let matches: Match[] = [];
  try {
    matches = await board(league || "all", dates);
  } catch {
    // fall through to the major leagues
  }
  if (!matches.length && !league) {
    const results = await Promise.allSettled(MAJOR.map((l) => board(l, dates)));
    matches = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }
  if (team) matches = matches.filter((m) => `${m.home} ${m.away}`.toLowerCase().includes(team));

  matches.sort((a, b) => b.date.localeCompare(a.date));
  const shown = matches.slice(0, team ? 10 : 25);
  return {
    dates,
    found: matches.length,
    matches: shown,
    note: "Source: ESPN. Times are UTC. If found is 0, no match was listed for these dates.",
  };
}