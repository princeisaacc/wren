# Wren

A personal AI assistant PWA. Users talk to it in plain language and it works with the Google services they connect (Calendar, Tasks, Gmail, Drive).

## What it does

- **Chat** — ask Wren anything in plain language. It reads your calendar, mail, tasks and files, and shows a confirm card before it changes anything.
- **Today** — a daily view of your schedule, tasks due today, and recent emails.
- **Connections** — connect or disconnect Google Calendar, Tasks, Gmail and Drive individually per account.
- **Web search** — Wren can search the web and news for current information without needing an extra account.
- **Football scores** — live scores and fixtures from ESPN, no API key needed.
- **Dark mode** — Light, Dark or System setting. No flash on load.
- **PWA** — installable on Android and iOS from the browser.

## Architecture

Every message goes through a **router** first (a cheap AI call with no tools). The router either:
- Answers directly (greetings, general chat) — zero agent calls
- Returns the exact 1-3 tools needed — agent is called with only those

This cuts token usage by roughly 75% versus sending all 19 tool definitions on every message.

The agent itself never acts without user confirmation. Every write (add event, send email, create file, delete task) shows a confirm card first.

## Stack

- **Next.js 14** (App Router, server components where possible)
- **Firebase Auth** — email/password and Google sign-in, per-user Firestore conversations
- **Composio** — holds Google OAuth tokens, exposes Calendar/Tasks/Gmail/Drive tools
- **Groq** (primary) + **Gemini 2.5 Flash** (fallback) — both tried on every request
- **ESPN public scoreboard** — football scores, no key needed
- **Composio Search** — DuckDuckGo, news, finance, URL fetch, no key needed
- **Tailwind CSS** with CSS variable color tokens — one place to change the whole theme

## Run locally

```bash
cp .env.example .env.local
# Fill in the values (see below)
npm install
npm run dev
```

Open http://localhost:3000 in a mobile-sized browser window.

## Environment variables

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
COMPOSIO_API_KEY=

Optional: set to "gemini" to make Gemini the primary and Groq the fallback
AI_PRIMARY=gemini

## Where things live

| Path | Purpose |
|------|---------|
| `src/lib/brand.ts` | App name, support email, year |
| `tailwind.config.ts` | Color tokens — change the palette here |
| `src/app/globals.css` | Light and dark CSS variable palettes, shared component styles |
| `src/components/theme.tsx` | ThemeProvider, useTheme, no-flash script |
| `src/lib/services.ts` | The four Google services and their capabilities |
| `src/lib/agent-tools.ts` | Every tool Wren can call, with write/read and danger flags |
| `src/lib/agent.ts` | The agent loop — reads run immediately, writes pause for confirm |
| `src/lib/football.ts` | ESPN scoreboard fetcher, no key needed |
| `src/lib/today.ts` | Loads today's events, tasks and emails in parallel |
| `src/app/api/chat/route.ts` | Router — decides what to do before calling the agent |
| `src/app/api/agent/route.ts` | Agent — calls Composio tools, streams steps back |
| `src/app/api/agent/execute/route.ts` | Runs one confirmed write action |
| `src/app/api/today/route.ts` | Serves the Today page data |
| `src/app/(app)/chat/page.tsx` | Chat UI — live steps, confirm cards, growing input |
| `src/app/(app)/today/page.tsx` | Today page — schedule, tasks, emails |
| `src/app/(app)/connections/page.tsx` | Connect/disconnect Google services |
| `src/app/(app)/settings/page.tsx` | Appearance, confirmations, timezone, account |
| `src/app/(app)/history/page.tsx` | Conversation list with search and delete |

## Before going public

- **Our own Google app** — the Composio consent screen currently shows "Composio". Switch to a verified Google app so it says Wren. Gmail requires Google review for sensitive scopes.
- **Rate limiting** — add a per-user limit on the AI routes.
- **Audit log** — log which tool ran and whether it succeeded, without storing content.
- **PDF and image reading** — past questions are PDFs and screenshots. Gemini can read them if Wren downloads the file first (not yet built).
- **Settings for real** — timezone and reminder time are shown but not yet saved to Firestore.
- **Drive delete** — needs a red confirm card like Delete event (not yet built).