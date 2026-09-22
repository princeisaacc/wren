# Wren

A personal assistant PWA. Users talk to it in plain language and it works with the Google services they connect (Calendar, Tasks, Gmail, Drive).

This is **step 1** of the build order: the full app shell with sample data. Nothing here talks to a real backend yet.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000 and use your phone's browser size (or DevTools mobile view).

## Where things live

- `src/lib/brand.ts` the app name, support email and year. Rename the app here.
- `tailwind.config.ts` the design tokens (colors, font). Change the look here.
- `src/app/globals.css` shared button, input and card styles.
- `src/lib/mock.ts` all sample data (user, events, tasks, emails, conversations).
- `src/lib/services.ts` the four services and what Wren can and cannot do with each.
- `src/components/connections-context.tsx` mock connection state and the Connect sheet.
- `src/app/(app)/` Chat, Today, Connections, Settings, History (inside the app shell).
- `src/app/(auth)/` Sign up, Log in, Onboarding.
- `src/app/(legal)/` Privacy, Terms, Contact. Draft text: have it reviewed before launch.

## What is mocked and which step replaces it

| Mock | Replaced in step |
| --- | --- |
| Sign up, log in, reset password (`setTimeout` then redirect) | 2, Firebase Auth |
| Route protection (none yet) | 2, sign-in check in `src/app/(app)/layout.tsx` |
| Chat replies (keyword matching in `chat/page.tsx`) | 3, real assistant with saved history |
| Connect, disconnect, connection status | 4, Composio |
| Confirm sheet actions (Calendar, Tasks) | 5, real tool calls |
| Gmail summaries, Drive search, Today data | 6 |
| Service worker and offline support | 7 |

## Rules this project follows

No gradients, no fake stats, no emoji icons, no em dashes, no stock images, no pill buttons, no blur effects. Icons are Lucide at one stroke weight. Corners are 8px on buttons and inputs and 12px on cards. Round shapes are only used for avatars and switches.

## Step 2: Firebase login

1. Copy `.env.example` to `.env.local` and fill in the four `NEXT_PUBLIC_FIREBASE_*` values.
2. Restart `npm run dev`.
3. Sign up, log out and log in again. Pages inside the app redirect to Log in when you are signed out.

Changed in this step: `src/lib/firebase.ts`, `src/components/auth-context.tsx`, `src/components/google-button.tsx`, the sign up and log in pages, the app layout (route protection), and every place that showed the sample user.
