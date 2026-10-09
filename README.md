# FitStake (hackathon POC)

Vite + React + Tailwind frontend, Hono API at `/api/*` (Vercel serverless), Turso + Drizzle, OpenAI recommendations, Reap Agentic Payments (sandbox).

## Deploy
Production branch: `claude/loving-euler-z1g9y3` (set under Vercel → Settings → Git).

Import the repo in Vercel and set the env vars from `.env.example` for Production, Preview and Development. The build runs `db:migrate` against Turso automatically, then `vite build`. The API is served from `api/[...route].ts` at `/api/*`.

Optional local run: `cp .env.example .env`, fill it in, then `npm run dev` (web :5173, api :8787) and `npm test`.

## Notes
- `server/reap.ts`: set `REAP_API_KEY` (version defaults to 2025-02-14) for the live Reap sandbox adapter; without them a local simulator runs. Reap mandates are not live yet, so Day 1 = hosted card enrolment and Day 30 = each payer approves their checkout via Reap's hosted page. The live adapter is untested against real Reap responses (amount units and variant resolution are assumptions; pin `variantId` in `server/merchants.ts` for the exact shorts size).
- Quotes use a fixed demo shipping address (`server/demoAddress.ts`).
- Only mandate terms are stored. No card data or API keys in the browser or DB.
- Settlement is idempotent (unique key per reward purchase, claimed before checkout).
- Outcome-dependent purchases may count as restricted gambling: get organiser clearance. No real-money staking.

## Local UI preview and assessment

See `docs/PRODUCT_ASSESSMENT.md` for product direction, verified flows, and pilot prerequisites. UI captures are in `docs/ui-preview.jpg` and `docs/challenge-preview.jpg`.

Use Node 22.9+ (Node 24 recommended). Run `npm install`, create `.env`, then `npm run db:migrate` and `npm run dev`. The API and migration commands load `.env` automatically. For isolated local development use `TURSO_DATABASE_URL=file:local.db`. Leave `REAP_API_KEY` empty to exercise the complete local simulator. Set a sandbox key and `REAP_BASE_URL=https://sg.sandbox.api.reap.global` for the Singapore Reap adapter. A connected badge indicates configuration, not a completed checkout.

Run `node --env-file=.env scripts/check-reap.mjs` for a read-only authenticated catalogue check. It prints status/product count without exposing credentials. Reap hosted flows require an HTTPS return URL; the localhost preview is intended for UI and simulated-flow verification.

Never commit `.env` or card details. Set rotated server credentials in the deployment environment. The app remains a hackathon POC without production authentication or verified live payment completion.
