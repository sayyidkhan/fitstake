# Agent Guide — FitStake

Use this file when you pick up the FitStake codebase. It is a fast-start reference for the stack, conventions, common commands, and things that have already bitten previous agents.

---

## What this is

FitStake is a 1-vs-1 fitness challenge proof-of-concept. Two friends compete for N days; the loser buys the winner's best reward, the winner buys the loser's lowest reward. AI suggests rewards within a spending cap; Reap Agentic Payments (sandbox) handles checkout.

- **Live site:** https://fitstake-eta.vercel.app
- **Production/default branch:** `claude/loving-euler-z1g9y3` (`main` was deleted on purpose)
- **Status:** hackathon POC — sandbox payments, simulated activity data

For the full project history, see `docs/HANDOFF.md`. For product direction, see `docs/PRODUCT_ASSESSMENT.md`.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS 4, `@fontsource-variable/inter` |
| API | Hono (TypeScript) served from `api/index.ts` as a Vercel serverless function |
| ORM / DB | Drizzle ORM + Turso (libSQL) |
| AI | OpenAI API (optional; falls back to cheapest/priciest picks) |
| Payments | Reap Agentic Payments sandbox, with a local simulator when no key is set |
| Email | Gmail SMTP (nodemailer) or Resend for login codes |

---

## Required tools

- Node.js ≥ 22.9 (Node 24 recommended)
- npm
- A Turso database URL + auth token, **or** use `TURSO_DATABASE_URL=file:local.db` for isolated local dev

---

## Common commands

```bash
# Install dependencies
npm install

# Local dev — runs web (:5173) and API (:8787)
npm run dev

# Type-check the whole repo
npm run typecheck

# Run tests
npm test

# Production build (also runs tsc)
npm run build

# Generate / run DB migrations
npm run db:generate
npm run db:migrate
```

Before committing, run at minimum:

```bash
npm run typecheck && npm test && npm run build
```

---

## Local setup

1. `cp .env.example .env`
2. Fill in `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (use `file:local.db` for a local-only DB).
3. Leave `REAP_API_KEY` empty to exercise the local simulator.
4. `npm install`
5. `npm run db:migrate`
6. `npm run dev`

The API and migration scripts auto-load `.env` via Node's `--env-file-if-exists=.env`. Never commit `.env`.

---

## Repo layout

```
api/index.ts            Vercel entry point (named GET/POST exports → Hono app)
server/app.ts           All routes, zod validation, same-origin checks
server/service.ts       Business logic: challenges, rewards, settlement, lobby
server/auth.ts          Email-code login and demo-mode rules
server/session.ts       Cookie helpers, requireUser, same-origin middleware
server/reap.ts          Live Reap adapter + local simulator
server/ai.ts            OpenAI reward recommender + fallback
server/merchants.ts     Supported catalogue items
server/scoring.ts       Deterministic scoring and tie-breaks
server/db/              Drizzle schema, client, migrations
shared/                 activities.ts, pricing.ts
src/App.tsx             Main React app (hash routing, SPA)
src/api.ts              Typed API client used by the frontend
src/legal.tsx           Privacy / Terms / Data Policy pages
src/index.css           Tailwind + custom design tokens
drizzle/                SQL migrations
scripts/check-reap.mjs  Read-only Reap connectivity check
tests/                  vitest tests
```

---

## Critical conventions

### Environment variables
- **Server-side only.** Never prefix env vars with `VITE_` — the browser must not see secrets.
- Required on Vercel: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Optional: `OPENAI_API_KEY`, `REAP_API_KEY`, `AUTH_SECRET`, email provider credentials.
- `AUTH_DEV_CODE=true` enables **insecure demo sign-in** (anyone can log in as any email). It is currently on in production for demos; remove it before real users.

### Server imports
Vercel functions crash on extensionless ESM imports. Always use `.js` for server imports, e.g.:

```ts
import { app } from "../server/app.js";
```

### Routing
The frontend uses hash routing:
- `#how-it-works`
- `#challenges` (public lobby)
- `#login`
- `#privacy`, `#terms`, `#data-policy`

The open challenge id is remembered in `localStorage` under `fitstake.challenge`; identity lives only in the HttpOnly session cookie.

### Database
- Migrations run on every Vercel build via `npm run db:migrate && vite build`.
- The latest migration (`0004`) includes a one-time `DELETE` of pre-account data. It is harmless on a fresh DB and has already run in production.

### Design tokens
Colours and spacing are CSS custom properties in `src/index.css`. The UI/UX session established a shared token set (WCAG AA). Prefer the tokens over one-off hex values.

---

## Known gotchas

1. **Merging to one branch caused conflicts before.** Pull before pushing, run `tsc && vitest && vite build` after every merge, and avoid resolving conflicts in a rush.
2. **Vite dev proxy rewrites `Host`.** The config uses `xfwd: true` so the API's same-origin check works locally.
3. **Reap mandates are not live.** The final-day charge uses per-purchase hosted approval, not automatic mandates.
4. **Only two real purchasable products exist in Reap.** The rest are simulator-only demo items unless `ENABLE_DEMO_CATALOGUE=true`.
5. **Reap end-to-end is unverified.** Quote → checkout → approval → `COMPLETED` has not been run against real Reap responses.

---

## Testing

```bash
npm test
```

Tests cover scoring, settlement lifecycle, privacy/auth, and email. There are no committed UI/Playwright tests yet; UI verification is currently manual.

---

## Security reminders

- Never commit `.env`, card details, or API keys.
- Authorisation is server-side; the API ignores any user id from the browser.
- Only challenge members can read/write a challenge; only the host can cancel.
- Card details stay with Reap. FitStake stores only names, emails, enrolment references, and spending caps.
- Legal pages (`src/legal.tsx`) are a Singapore PDPA-oriented draft and must be reviewed by counsel before launch.

---

## If you need more context

- `docs/HANDOFF.md` — full history, architecture, payments status, risks, demo script.
- `docs/PRODUCT_ASSESSMENT.md` — product recommendation, validation notes, remaining work.
- `README.md` — shorter public-facing overview.
