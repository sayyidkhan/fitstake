# FitStake (hackathon POC)

Vite + React + Tailwind frontend, Hono API at `/api/*` (Vercel serverless), Turso + Drizzle, OpenAI recommendations, Reap Agentic Payments (sandbox).

## Run
```
cp .env.example .env   # fill in TURSO_AUTH_TOKEN etc.; leave TURSO_DATABASE_URL unset for a local file DB
npm run db:migrate
npm run dev            # web :5173, api :8787
npm test
```
Deploy: import the repo in Vercel, set the env vars from `.env.example`, run `npm run db:migrate` once against Turso.

## Notes
- `server/reap.ts` is a sandbox simulator. The live Reap calls are not implemented and Day 1 to Day 30 mandate validity must be verified with Reap. Without it, checkouts fail with "fresh approval required".
- Only mandate terms are stored. No card data or API keys in the browser or DB.
- Settlement is idempotent (unique key per reward purchase, claimed before checkout).
- Outcome-dependent purchases may count as restricted gambling: get organiser clearance. No real-money staking.
