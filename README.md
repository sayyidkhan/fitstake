# FitStake

A 1-vs-1 fitness challenge proof-of-concept. Two friends commit to a healthy activity for a set number of days. The loser buys the winner's best reward; the winner buys the loser's lowest reward. Everyone gets something, and better progress unlocks the better prize.

Built with **Vite + React + Tailwind CSS** on the frontend, **Hono + Drizzle + Turso** on the backend, and **Reap Agentic Payments** (sandbox) for checkout.

- **Live site:** https://fitstake-eta.vercel.app
- **Production branch:** `claude/loving-euler-z1g9y3`
- **Full project context:** see [`docs/HANDOFF.md`](docs/HANDOFF.md)
- **Agent quick-start:** see [`AGENTS.md`](AGENTS.md)

---

## What it does

1. **Create or join a challenge** — set an activity and duration (1–365 days), then invite a friend or join from the public lobby.
2. **Lock in rewards** — the AI suggests a lowest and best reward within your spending cap.
3. **Enrol a card** — through Reap's hosted sandbox page, with a clear spending ceiling.
4. **Compete** — daily active minutes (capped at 90) plus a bonus for 30+ minute days. Scoring is fully deterministic.
5. **Settle** — the loser buys the winner's best reward; the winner buys the loser's lowest. Each purchase is approved separately.

This is a **sandbox-only hackathon POC**: fitness data is simulated and no real money moves.

---

## Quick start

Requires **Node.js ≥ 22.9** (Node 24 recommended).

```bash
npm install

# Copy the example env file and fill it in
cp .env.example .env

# For isolated local development, use a file-based DB:
# TURSO_DATABASE_URL=file:local.db

npm run db:migrate
npm run dev
```

- Web frontend: http://localhost:5173
- API: http://localhost:8787

Run tests and type checks:

```bash
npm test
npm run typecheck
```

A full build (also runs `tsc`):

```bash
npm run build
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS 4, `@fontsource-variable/inter` |
| API | Hono (TypeScript), Vercel serverless function via `api/index.ts` |
| Database | Turso (libSQL) with Drizzle ORM |
| AI | OpenAI API for reward suggestions (optional; has fallback) |
| Payments | Reap Agentic Payments sandbox, plus a local simulator when no key is set |
| Auth | Email-code login with HttpOnly sessions; optional demo mode |
| Email | Gmail SMTP (nodemailer) or Resend |

---

## Deploy to Vercel

1. Import the repo in Vercel.
2. Set the production branch to `claude/loving-euler-z1g9y3`.
3. Add the required environment variables under **Project Settings → Environment Variables** (set for Production, Preview, and Development, then redeploy):

| Variable | Required? | Notes |
|----------|-----------|-------|
| `TURSO_DATABASE_URL` | Yes | `libsql://…` or `file:local.db` |
| `TURSO_AUTH_TOKEN` | Yes | Token for the Turso database |
| `AUTH_SECRET` | For real auth | 32+ random chars |
| `GMAIL_USER` + `GMAIL_APP_PASSWORD` | One email provider needed for real login | Or use `RESEND_API_KEY` + `EMAIL_FROM` |
| `OPENAI_API_KEY` | Optional | Enables AI reward explanations |
| `REAP_API_KEY` | For live payments | Without it, the local simulator runs |
| `AUTH_DEV_CODE` | Demo only | `true` = instant insecure sign-in. Currently on in production for demos; remove before real users. |

Build command (already configured in `vercel.json`):

```bash
npm run db:migrate && vite build
```

Migrations run on every deploy and are idempotent. The API is served from `api/index.ts` with `GET`/`POST` exports.

**Important:** keep env vars server-side only. Never use a `VITE_` prefix for secrets, and never commit `.env` files.

---

## Repo map

```
api/index.ts            Vercel entry point (named GET/POST exports)
server/app.ts           Routes, validation, same-origin checks
server/service.ts       Business logic for challenges, rewards, settlement, lobby
server/auth.ts          Email-code login and demo mode
server/session.ts       Cookie helpers, requireUser, same-origin middleware
server/reap.ts          Live Reap adapter + local simulator
server/ai.ts            OpenAI reward recommender + fallback
server/merchants.ts     Supported catalogue items
server/scoring.ts       Deterministic scoring and tie-breaks
server/db/              Drizzle schema, client, migrations
shared/                 activities.ts, pricing.ts
src/App.tsx             React SPA with hash routing
src/api.ts              Typed API client
src/legal.tsx           Privacy, Terms, and Data Policy pages
src/index.css           Tailwind + design tokens
drizzle/                SQL migrations
scripts/check-reap.mjs  Read-only Reap connectivity check
tests/                  Vitest tests
```

---

## Product rules

- **Scoring:** 1 point per active minute, capped at 90/day, plus 10 bonus points for any day with ≥ 30 minutes.
- **Tie-breaks:** more active days → more steps → stable hash of the challenge id.
- **Rewards:** each player locks one lowest-value and one best-value reward. The AI only suggests items within the player's spending cap.
- **Start:** the challenge activates once both players have locked rewards, enrolled a card, and set a cap high enough to cover the friend's best reward.
- **Settlement:** the loser buys the winner's best reward; the winner buys the loser's lowest reward. Each purchase is a separate, idempotent, retryable transaction.

---

## Important notes

- **Demo mode is on.** `AUTH_DEV_CODE=true` in production lets anyone sign in as any email with no code. Turn this off and configure real email before accepting real users.
- **Legal pages are a draft.** `src/legal.tsx` is a Singapore PDPA-oriented draft with placeholders. It must be reviewed by counsel and filled in before launch.
- **Reap flow is partly unproven.** API key, version header, and hosted enrolment session creation work, but the full quote → checkout → approval → `COMPLETED` flow has not been run end to end.
- **Outcome-dependent purchases** may fall under restricted categories (gambling/lottery/payment-services). Get organiser/provider clearance before enabling real money.
- **No real-money staking.** This build stays in sandbox.

---

## More docs

- [`AGENTS.md`](AGENTS.md) — conventions, commands, and gotchas for anyone working on the code.
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — full project history, architecture, payments status, risks, and demo script.
- [`docs/PRODUCT_ASSESSMENT.md`](docs/PRODUCT_ASSESSMENT.md) — product recommendation, validation notes, and remaining work.
