/**
 * Wren Settings — server-side only.
 *
 * User preferences are stored at:
 *   /users/{uid}/prefs/settings  ->  { timezone, defaultReminderTime, askBeforeChanges, personality }
 *
 * Mirrors the read/write pattern used in src/lib/memory.ts — same Firestore
 * REST approach, same auth (the user's own idToken, scoped by security rules).
 */

export type PersonalityKey =
  | "neutral"
  | "friendly"
  | "professional"
  | "candid"
  | "efficient"
  | "warm"
  | "playful";

// Seven tones, one line each describing how they change replies, plus the exact
// instruction injected into the system prompt. "neutral" is the default — it's
// how Wren already talks, so picking it changes nothing.
export const PERSONALITIES: Record<PersonalityKey, { label: string; blurb: string; prompt: string }> = {
  neutral: {
    label: "Neutral (default)",
    blurb: "Balanced and clear — how Wren normally talks. Good if you're not sure which to pick.",
    prompt: "Respond in a plain, balanced tone — clear and to the point, without leaning especially warm or especially formal.",
  },
  friendly: {
    label: "Friendly & Casual",
    blurb: "Warm and conversational, like a friend who happens to be very organized.",
    prompt: "Respond warmly and conversationally. Use contractions and a relaxed tone, like a friend helping out.",
  },
  professional: {
    label: "Professional & Concise",
    blurb: "Formal, structured, business-appropriate. Good for work use.",
    prompt: "Respond formally and concisely, using clear business language. No small talk.",
  },
  candid: {
    label: "Candid & Direct",
    blurb: "Straight, no sugar-coating — tells you plainly what's going on.",
    prompt: "Respond directly and plainly. Skip softening language and get straight to the point, even with bad news.",
  },
  efficient: {
    label: "Efficient",
    blurb: "Shortest possible answers — just the facts, minimal explanation.",
    prompt: "Respond as briefly as possible — the minimum words needed to answer. No extra explanation unless asked for it.",
  },
  warm: {
    label: "Warm & Encouraging",
    blurb: "Supportive and positive, with a bit of encouragement along the way.",
    prompt: "Respond with warmth and encouragement. Acknowledge effort and stay positive, without being over the top.",
  },
  playful: {
    label: "Witty & Playful",
    blurb: "A little humor and personality mixed in, while still getting things done.",
    prompt: "Respond with a light, witty touch and occasional humor, while staying genuinely useful — never silly about anything serious.",
  },
};

export const DEFAULT_PERSONALITY: PersonalityKey = "neutral";

export type UserSettings = {
  timezone: string;
  defaultReminderTime: string;
  askBeforeChanges: boolean;
  personality: PersonalityKey;
};

export const DEFAULT_SETTINGS: UserSettings = {
  timezone: "Africa/Lagos",
  defaultReminderTime: "8:00 AM",
  askBeforeChanges: true,
  personality: DEFAULT_PERSONALITY,
};

function isPersonalityKey(v: unknown): v is PersonalityKey {
  return typeof v === "string" && v in PERSONALITIES;
}

const FIRESTORE_URL = (projectId: string, uid: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/prefs/settings`;

export async function readSettings(uid: string, idToken: string): Promise<UserSettings> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return DEFAULT_SETTINGS;
  try {
    const res = await fetch(FIRESTORE_URL(projectId, uid), {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return DEFAULT_SETTINGS;
    if (!res.ok) return DEFAULT_SETTINGS;
    const doc = await res.json();
    const f = doc?.fields ?? {};
    return {
      timezone: typeof f.timezone?.stringValue === "string" ? f.timezone.stringValue : DEFAULT_SETTINGS.timezone,
      defaultReminderTime:
        typeof f.defaultReminderTime?.stringValue === "string" ? f.defaultReminderTime.stringValue : DEFAULT_SETTINGS.defaultReminderTime,
      askBeforeChanges:
        typeof f.askBeforeChanges?.booleanValue === "boolean" ? f.askBeforeChanges.booleanValue : DEFAULT_SETTINGS.askBeforeChanges,
      personality: isPersonalityKey(f.personality?.stringValue) ? f.personality.stringValue : DEFAULT_SETTINGS.personality,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(uid: string, idToken: string, settings: UserSettings): Promise<boolean> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return false;
  try {
    const mask = ["timezone", "defaultReminderTime", "askBeforeChanges", "personality"]
      .map((k) => `updateMask.fieldPaths=${k}`)
      .join("&");
    const res = await fetch(`${FIRESTORE_URL(projectId, uid)}?${mask}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          timezone: { stringValue: settings.timezone },
          defaultReminderTime: { stringValue: settings.defaultReminderTime },
          askBeforeChanges: { booleanValue: settings.askBeforeChanges },
          personality: { stringValue: settings.personality },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}