# FitStake (hackathon POC)

Vite + React + Tailwind frontend, Hono API at `/api/*` (Vercel serverless), Turso + Drizzle, OpenAI recommendations, Reap Agentic Payments (sandbox).

## Run
```
cp .env.example .env   # fill in TURSO_AUTH_TOKEN etc.; leave TURSO_DATABASE_URL unset for a local file DB
npm run db:migrate
npm run dev            # web :5173, api :8787
npm test
```
Deploy: import the repo in Vercel and set the env vars from `.env.example` (all environments you deploy to, incl. Preview). The build runs `db:migrate` against Turso automatically.

## Notes
- `server/reap.ts`: set `REAP_API_KEY` (version defaults to 2025-02-14) for the live Reap sandbox adapter; without them a local simulator runs. Reap mandates are not live yet, so Day 1 = hosted card enrolment and Day 30 = each payer approves their checkout via Reap's hosted page. The live adapter is untested against real Reap responses (amount units and variant resolution are assumptions; pin `variantId` in `server/merchants.ts` for the exact shorts size).
- Quotes use a fixed demo shipping address (`server/demoAddress.ts`).
- Only mandate terms are stored. No card data or API keys in the browser or DB.
- Settlement is idempotent (unique key per reward purchase, claimed before checkout).
- Outcome-dependent purchases may count as restricted gambling: get organiser clearance. No real-money staking.
