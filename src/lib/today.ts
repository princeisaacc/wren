import { getComposio, toolkitSlug, userSession } from "@/lib/composio";
import type { ServiceKey } from "@/lib/services";

export type TodayEvent = { id: string; title: string; start: string; end: string; allDay: boolean; place: string; link: string };
export type TodayTask = { id: string; title: string; due: string; overdue: boolean };
export type TodayEmail = { id: string; from: string; subject: string; snippet: string; time: string; link: string };
export type TodayData = {
  connected: Record<ServiceKey, boolean>;
  events: TodayEvent[];
  tasks: TodayTask[];
  emails: TodayEmail[];
  errors: Partial<Record<"calendar" | "tasks" | "gmail", string>>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;
const text = (v: unknown) => (typeof v === "string" ? v : "");

// The tools wrap Google's answers in different shapes, so look for the list instead of assuming where it is.
function findList(v: unknown, test: (x: Obj) => boolean, depth = 0): Obj[] | null {
  if (depth > 5 || !v || typeof v !== "object") return null;
  if (Array.isArray(v)) {
    const objs = v.filter((x): x is Obj => !!x && typeof x === "object");
    if (objs.length && test(objs[0])) return objs;
    for (const x of v) {
      const found = findList(x, test, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = v as Obj;
  for (const [k, x] of Object.entries(obj)) {
    if (Array.isArray(x) && x.length === 0 && /items|events|messages|tasks|results/i.test(k)) return [];
  }
  for (const x of Object.values(obj)) {
    const found = findList(x, test, depth + 1);
    if (found) return found;
  }
  return null;
}

export function parseEvents(data: unknown): TodayEvent[] | null {
  const list = findList(data, (e) => "start" in e || "summary" in e);
  if (!list) return null;
  return list
    .map((e) => {
      const start = text(e.start?.dateTime) || text(e.start?.date) || text(e.start);
      const end = text(e.end?.dateTime) || text(e.end?.date) || text(e.end);
      return {
        id: text(e.id) || `${start}-${text(e.summary)}`,
        title: text(e.summary) || text(e.title) || "Untitled event",
        start,
        end,
        allDay: !!start && !start.includes("T"),
        place: text(e.location),
        link: text(e.htmlLink),
      };
    })
    .filter((e) => e.start)
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Tasks that are not finished and due today or earlier. "today" is the user's date as YYYY-MM-DD.
export function parseTasks(data: unknown, today: string): TodayTask[] | null {
  const list = findList(data, (t) => "title" in t && ("status" in t || "due" in t || "id" in t));
  if (!list) return null;
  return list
    .filter((t) => text(t.status) !== "completed" && text(t.due) && text(t.due).slice(0, 10) <= today)
    .map((t) => ({ id: text(t.id) || text(t.title), title: text(t.title), due: text(t.due).slice(0, 10), overdue: text(t.due).slice(0, 10) < today }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

export function parseEmails(data: unknown): TodayEmail[] | null {
  const list = findList(data, (m) => "subject" in m || "messageId" in m || "preview" in m);
  if (!list) return null;
  return list.map((m) => {
    const id = text(m.messageId) || text(m.id);
    const from = text(m.sender) || text(m.from) || "Unknown sender";
    return {
      id,
      from: from.replace(/<.*>/, "").replace(/"/g, "").trim() || from,
      subject: text(m.subject) || text(m.preview?.subject) || "(no subject)",
      snippet: (text(m.preview?.body) || text(m.snippet) || text(m.messageText)).replace(/\s+/g, " ").trim().slice(0, 160),
      time: text(m.messageTimestamp) || text(m.date),
      link: id ? `https://mail.google.com/mail/u/0/#inbox/${id}` : "https://mail.google.com/",
    };
  });
}

const paramCache = new Map<string, string[]>();
async function paramNames(slug: string): Promise<string[]> {
  if (paramCache.has(slug)) return paramCache.get(slug)!;
  try {
    const raw = await getComposio().tools.getRawComposioTools({ tools: [slug] });
    const names = Object.keys(((raw[0]?.inputParameters as Obj)?.properties as Obj) ?? {});
    if (names.length) paramCache.set(slug, names);
    return names;
  } catch {
    return [];
  }
}

export async function loadToday(uid: string, range: { start: string; end: string; today: string }): Promise<TodayData> {
  const session = await userSession(uid);
  const status = await session.toolkits({ toolkits: Object.values(toolkitSlug) });
  const connected = (Object.keys(toolkitSlug) as ServiceKey[]).reduce(
    (acc, k) => ({ ...acc, [k]: !!status.items.find((i) => i.slug === toolkitSlug[k])?.connection?.isActive }),
    {} as Record<ServiceKey, boolean>,
  );
  const out: TodayData = { connected, events: [], tasks: [], emails: [], errors: {} };

  const run = async (slug: string, args: Obj) => {
    const res = await session.execute(slug, args);
    if (res.error) throw new Error(String(res.error).slice(0, 200));
    return res.data;
  };

  await Promise.all([
    connected.calendar &&
      (async () => {
        try {
          const names = await paramNames("GOOGLECALENDAR_EVENTS_LIST");
          const args: Obj = {};
          const set = (re: RegExp, value: unknown) => {
            const key = names.find((n) => re.test(n.toLowerCase().replace(/_/g, "")));
            if (key) args[key] = value;
          };
          set(/^timemin$/, range.start);
          set(/^timemax$/, range.end);
          set(/^singleevents$/, true);
          set(/^orderby$/, "startTime");
          set(/^maxresults$/, 15);
          const data = await run("GOOGLECALENDAR_EVENTS_LIST", names.length ? args : { timeMin: range.start, timeMax: range.end, singleEvents: true, orderBy: "startTime", maxResults: 15 });
          const events = parseEvents(data);
          if (!events) throw new Error("unrecognized calendar result: " + Object.keys((data as Obj) ?? {}).join(","));
          out.events = events;
        } catch (e) {
          console.error("today calendar failed:", e instanceof Error ? e.message : "unknown");
          out.errors.calendar = "Could not load your calendar.";
        }
      })(),
    connected.tasks &&
      (async () => {
        try {
          const data = await run("GOOGLETASKS_LIST_ALL_TASKS", {});
          const tasks = parseTasks(data, range.today);
          if (!tasks) throw new Error("unrecognized tasks result: " + Object.keys((data as Obj) ?? {}).join(","));
          out.tasks = tasks;
        } catch (e) {
          console.error("today tasks failed:", e instanceof Error ? e.message : "unknown");
          out.errors.tasks = "Could not load your tasks.";
        }
      })(),
    connected.gmail &&
      (async () => {
        try {
          let data: unknown;
          try {
            data = await run("GMAIL_FETCH_EMAILS", { query: "is:unread newer_than:3d", max_results: 5 });
          } catch {
            data = await run("GMAIL_FETCH_EMAILS", { max_results: 5 });
          }
          const emails = parseEmails(data);
          if (!emails) throw new Error("unrecognized email result: " + Object.keys((data as Obj) ?? {}).join(","));
          out.emails = emails;
        } catch (e) {
          console.error("today gmail failed:", e instanceof Error ? e.message : "unknown");
          out.errors.gmail = "Could not load your emails.";
        }
      })(),
  ]);
  return out;
}