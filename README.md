# FitStake (hackathon POC)

Vite + React + Tailwind frontend, Hono API at `/api/*` (Vercel serverless), Turso + Drizzle, OpenAI recommendations, Reap Agentic Payments (sandbox).

## Deploy
Production branch: `claude/loving-euler-z1g9y3` (set under Vercel → Settings → Git).

Import the repo in Vercel and set the env vars from `.env.example` for Production, Preview and Development. The build runs `db:migrate` against Turso automatically, then `vite build`. The API is served from `api/index.ts`; `vercel.json` routes every `/api/*` path to this function, including nested challenge routes. Named `GET` and `POST` exports use Vercel's Web Request/Response handlers.

Before deploying, open **Vercel → Project Settings → Environment Variables** and add:

- `TURSO_DATABASE_URL`: your Turso database URL (`libsql://…`; the project's example is in `.env.example`).
- `TURSO_AUTH_TOKEN`: a valid token for that database.

Select **Production** for deployments from the configured production branch and **Preview** for other branches. Save the variables, then redeploy; existing deployments do not receive newly saved values. A local `.env` file and `.env.example` do not configure Vercel's environment variables. Keep these variables server-side, without a `VITE_` prefix.

If the build reports `ENOTFOUND turso_database_url-not-set.invalid`, the deployment is missing `TURSO_DATABASE_URL`. The migration script now checks both required variables before connecting and reports the missing names directly. Keep migrations enabled so a successful deployment has its database tables ready.

Optional local run: `cp .env.example .env`, fill it in, then `npm run dev` (web :5173, api :8787) and `npm test`.

## Notes
- `server/reap.ts`: set `REAP_API_KEY` (version defaults to 2025-02-14) for the live Reap sandbox adapter; without them a local simulator runs. Reap mandates are not live yet, so Day 1 = hosted card enrolment and Day 30 = each payer approves their checkout via Reap's hosted page. The live adapter is untested against real Reap responses (amount units and variant resolution are assumptions; pin `variantId` in `server/merchants.ts` for the exact shorts size).
- Quotes use a fixed demo shipping address (`server/demoAddress.ts`).
- Only mandate terms are stored. No card data or API keys in the browser or DB.
- Settlement is idempotent (unique key per reward purchase, claimed before checkout).
- Outcome-dependent purchases may count as restricted gambling: get organiser clearance. No real-money staking.

## Legal pages (Singapore)

The site serves three pages at `#privacy`, `#terms` and `#data-policy`, with source in `src/legal.tsx`. They are a PDPA-oriented draft and must be reviewed by Singapore counsel before launch.

- Fill in every highlighted placeholder in `src/legal.tsx` (`LEGAL` block and any bracketed text): UEN, registered address, DPO/privacy email, liability cap, retention periods and the Reap notice reference.
- Users accept the current `TERMS_VERSION` (`server/legal.ts`) **once, when they create their account** (sign-up requires `acceptedTerms: true`). The accepted version and time are stored on the user. Bump `TERMS_VERSION` and `LEGAL.lastUpdated` whenever the pages change materially.
- Real-money purchases and real activity data must not be enabled until the gambling, lottery and payment-services questions in the Terms (section 1) are confirmed with counsel.

## Local UI preview and assessment

See `docs/PRODUCT_ASSESSMENT.md` for product direction, verified flows, and pilot prerequisites. UI captures are in `docs/ui-preview.jpg` and `docs/challenge-preview.jpg`.

Use Node 22.9+ (Node 24 recommended). Run `npm install`, create `.env`, then `npm run db:migrate` and `npm run dev`. The API and migration commands load `.env` automatically. For isolated local development use `TURSO_DATABASE_URL=file:local.db`. Leave `REAP_API_KEY` empty to exercise the complete local simulator. Set a sandbox key and `REAP_BASE_URL=https://sg.sandbox.api.reap.global` for the Singapore Reap adapter. A connected badge indicates configuration, not a completed checkout.

Run `node --env-file=.env scripts/check-reap.mjs` for a read-only authenticated catalogue check. It prints status/product count without exposing credentials. Reap hosted flows require an HTTPS return URL; the localhost preview is intended for UI and simulated-flow verification.

Never commit `.env` or card details. Set rotated server credentials in the deployment environment. The app is a hackathon POC: accounts use email-code login (demo mode `AUTH_DEV_CODE=true` skips verification and must not be used with real users), and live payment completion is not yet verified. See `docs/HANDOFF.md` for the full project handoff.
