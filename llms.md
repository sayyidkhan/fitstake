# FitStake — LLM Context

Concise project reference for AI assistants working on this codebase.

## What this is

FitStake is a hackathon POC for a 1-vs-1 fitness challenge. Two friends compete for N days; the loser buys the winner's best reward, the winner buys the loser's lowest reward. AI suggests rewards within a spending cap; Reap Agentic Payments (sandbox) handles checkout.

- Live site: https://fitstake-eta.vercel.app
- Production/default branch: `claude/loving-euler-z1g9y3` (`main` was deleted)
- Full handoff: `docs/HANDOFF.md`
- Agent guide: `AGENTS.md`

## Stack

- Frontend: React 19, Vite, Tailwind CSS 4, `@fontsource-variable/inter`
- API: Hono (TypeScript) served via `api/index.ts` as a Vercel serverless function
- Database: Drizzle ORM + Turso (libSQL)
- AI: OpenAI API (optional, with fallback)
- Payments: Reap Agentic Payments sandbox, with a local simulator when `REAP_API_KEY` is absent
- Auth: email-code login with HttpOnly sessions; insecure demo mode when `AUTH_DEV_CODE=true`

## Common commands

```bash
npm install
npm run dev          # web :5173, api :8787
npm run typecheck
npm test
npm run build        # also runs tsc
npm run db:migrate
```

Always run `npm run typecheck && npm test && npm run build` after merges.

## Key files

```
api/index.ts            Vercel entry point (named GET/POST exports)
server/app.ts           All routes + zod validation + same-origin check
server/service.ts       Business logic: challenges, lobby, rewards, settle
server/auth.ts          Login codes, sessions, demo mode
server/session.ts       Cookie helpers, requireUser, same-origin middleware
server/reap.ts          Live Reap adapter + local simulator
server/ai.ts            OpenAI recommender + fallback
server/merchants.ts     Catalogue
server/scoring.ts       Deterministic scoring and tie-breaks
server/db/schema.ts     Drizzle schema
shared/activities.ts    ~35 sports/activities
shared/pricing.ts       Price bands
src/App.tsx             React SPA with hash routing
src/api.ts              Typed API client
src/legal.tsx           Privacy / Terms / Data Policy pages
src/index.css           Tailwind + design tokens
```

## Critical conventions

1. **Env vars are server-side only.** Never prefix secrets with `VITE_`. Never commit `.env`.
2. **Server imports need `.js` extensions.** Vercel functions crash on extensionless ESM imports.
3. **Frontend uses hash routing:** `#how-it-works`, `#challenges`, `#login`, `#privacy`, `#terms`, `#data-policy`.
4. **Migrations run on every Vercel build** via `npm run db:migrate && vite build`.
5. **Design tokens live in `src/index.css`.** Prefer CSS custom properties over one-off values.

## Important gotchas

- `AUTH_DEV_CODE=true` is currently on in production; anyone can log in as any email. Remove before real users.
- Reap mandates are not live; final-day charges use per-purchase hosted approval.
- Full Reap quote → checkout → approval → `COMPLETED` has never been run end to end.
- Only two real purchasable products exist in Reap; other items are simulator-only.
- Legal pages in `src/legal.tsx` are a Singapore PDPA draft with placeholders; needs counsel review.
- Outcome-dependent purchases may fall under restricted gambling/lottery/payment-services categories.

## Tests

Vitest tests cover scoring, settlement lifecycle, privacy/auth, and email. No committed UI tests yet.
