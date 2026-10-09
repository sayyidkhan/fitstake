# FitStake: Project Handoff

_Written 9 Oct 2026. Covers everything built so far across the four Claude sessions and the human contributors who worked on this repository. Contains no secrets: environment variables are listed by name only._

> **How this was assembled.** Written by the "main" session (the one that built the backend, payments, lobby, accounts, etc.). I could read my own session in full. For the other three sessions and the human contributors, I used the git history, PR descriptions and the code itself. Where that leaves a gap, it is marked **(unverified)**.

---

## 1. Snapshot

| | |
|---|---|
| **Product** | FitStake: a 1-vs-1 fitness challenge. Two friends compete for N days; the **loser buys the winner's best reward, the winner buys the loser's lowest reward**. An AI helps pick rewards; Reap's agentic payments handle checkout. |
| **Live site** | https://fitstake-eta.vercel.app (the older `fitstake-one.vercel.app` URL is dead) |
| **Repo** | https://github.com/sayyidkhan/fitstake |
| **Working branch** | `claude/loving-euler-z1g9y3`. It is also the **default and production branch**: `main` was deleted on purpose. |
| **Status** | Proof of concept / hackathon demo. Sandbox payments only. Simulated fitness data. |
| **Health at time of writing** | Production `/api/health` is OK, DB reachable. `/api/config` reports `auth: demo`, `payments: reap_sandbox`. Deployed JS bundle matches commit `5732cde`. |
| **Tests** | 42 passing across 5 files (`npm test`). `tsc` and `vite build` clean. |
| **Users in prod DB** | 0 (the accounts launch wiped all earlier test data, as agreed). |

**One-paragraph status:** The whole product loop works end to end *in the local simulator*: sign up, create or join from a lobby, pick AI-suggested rewards inside a spending cap, enrol a (simulated) card, simulate activity, settle, and see two purchases. Against **real Reap**, only the first part is proven (the API key, version header, Singapore sandbox host, and creating hosted card-enrolment sessions all work). The hosted card page needs a real passkey, so **quote → checkout → approval → completion has never been run against Reap**. That is the biggest unknown.

---

## 2. Who did what

Four Claude sessions plus three human contributors pushed to the same branch. Session IDs are the `Claude-Session` trailers in commits.

### 2.1 The four Claude sessions

| # | Session (ID suffix) | Role | What it delivered |
|---|---|---|---|
| 1 | **Main**: `…01SHdWJV5JrbuQuX9x9cTGEk` | Product + backend + payments + accounts | Everything in section 2.2 below |
| 2 | **UI/UX**: `…016ei2Ea5g87bMPTN5Np8us6` | Whole-site design pass (PR #5) | Responsive scaling and spacing, shared colour tokens (WCAG AA), bundled Inter font, one SVG icon set, 44px targets and 16px inputs, skip link, real dashboard data instead of hard-coded "S$58", header fixes on phones, restyled every feature that landed from production (lobby, legal, cancel, images, spending-cap, accounts, demo sign-in). It states it used the *impeccable, anti-slop, ui-ux-pro-max* design skills. Checked widths 320–2560px; ran the full flow in a browser. |
| 3 | **Lobby Join fix**: `…01VzkSabpGsz3iBB3xg57qEL` | Small UX fixes (PRs #6, #7) | Made lobby **Join** clickable with a clear explanation of what's missing (PR #6, later superseded by the accounts rework because name/email fields no longer exist); added the **"You've joined…" confirmation banner** after joining from the lobby (PR #7, merged). |
| 4 | **Legal**: `…01AkSZiWywjbQf3mm6bQu39p` | Singapore legal pages | Privacy Policy, Terms, and Data Policy pages (`src/legal.tsx`), `TERMS_VERSION` tracking (`server/legal.ts`), DB columns `terms_version` / `terms_accepted_at`, footer links (made more visible), and **removal of "Cybrdeck" from legal pages and footer** at the owner's request. Documented as a PDPA-oriented *draft* needing counsel review. |

### 2.2 What the Main session built (in order)

1. **Scaffold** from the two PDFs (concept/workflow and tech stack): Vite + React + Tailwind, Hono API, Drizzle + Turso, one Vercel project.
2. **Domain logic**: deterministic scoring, Day-N settlement, **idempotent** checkouts (unique key per purchase, row "claimed" before checkout, new provider key per retry).
3. **Reap adapter** (hosted card enrolment, quotes, checkouts) plus a local simulator used when no key is set. Found from Reap's docs that **mandates are not live**, so the design uses *hosted approval per purchase* on the final day instead of automatic pre-authorised charges.
4. **Production fixes**: the `FUNCTION_INVOCATION_FAILED` crash (extensionless ESM imports → added `.js` extensions), DB-backed `/api/health`, readable errors.
5. **Six-step workflow UI** and a **How it works** tab; **configurable challenge length (1–365 days)**.
6. **Activity types**: ~35 Singapore-accessible activities/sports (`shared/activities.ts`), shown on the dashboard, tailoring simulated step counts.
7. **Public lobby ("server browser")**: open challenges listed, full or started ones disappear; **atomic seat claim** so simultaneous joins can never overfill; optional invite-only challenges; invite links (`/?join=CODE`).
8. **Cancel challenge** (host only, before start), with the guest notified automatically.
9. **Product images** in suggested rewards (built-in illustrations; optional `imageUrl` for real photos).
10. **Spending cap drives rewards** (section 4.3).
11. **Accounts** (section 5): email-code login, HttpOnly sessions, server-side access control, "My challenges", **one-time DB wipe**.
12. **Gmail provider** for login emails (app password) and a **zero-email demo mode** (`AUTH_DEV_CODE=true`).

### 2.3 Human contributors

| Person | Contribution |
|---|---|
| **Benjamin Lim** (directs the work) | Gave all product direction; merged PRs (appears as author of the squash/merge commits); set up the Vercel project and env vars; deleted `main`. |
| **Malcolm Toh** | `a3d9f00`: onboarding and dashboard improvements, the Singapore Reap sandbox host fix (`sg.sandbox.api.reap.global`), `AVAILABLE_ONLY` product filter, `scripts/check-reap.mjs` (read-only Reap catalogue check), `docs/PRODUCT_ASSESSMENT.md`, Node ≥ 22.9 `--env-file` scripts. |
| **Sayyid Khan** | `f5e0ffc`: fixed Vercel API handler shape (`api/index.ts` with named `GET`/`POST` exports) and nested route forwarding in `vercel.json`. The GitHub account that owns the repo (and appears in the Turso DB name). |

---

## 3. Architecture

```
Browser (React SPA, hash routing)
   │  same-origin fetch, HttpOnly session cookie
   ▼
Vercel project (one deployment)
   ├─ static: dist/  (Vite build)
   └─ serverless: api/index.ts  →  Hono app (server/app.ts) at /api/*
                                     ├─ Turso (libSQL) via Drizzle
                                     ├─ OpenAI  (reward suggestions; optional)
                                     ├─ Reap Agentic Payments (sandbox) or local simulator
                                     └─ Gmail SMTP / Resend (login emails)
```

- **Stack:** React 19 + Vite + Tailwind 4 · Hono (TypeScript) · Drizzle ORM · Turso · OpenAI API · Reap · Vercel.
- **Build on Vercel:** `npm run db:migrate && vite build`: **migrations run on every deploy** (idempotent; tracked by Drizzle).
- **Routing:** hash-based (`#challenges`, `#how-it-works`, `#login`, `#privacy`, `#terms`, `#data-policy`). The open challenge is remembered by id in `localStorage`; *identity* lives only in the cookie.

### 3.1 Repo map

```
api/index.ts            Vercel entry (named GET/POST exports wrap the Hono app)
server/app.ts           All routes + zod validation + same-origin check
server/service.ts       Business logic: challenges, lobby, rewards, authorise, settle, state
server/auth.ts          Login codes, sessions, demo-mode rules
server/session.ts       Cookie helpers, requireUser middleware, same-origin middleware
server/email.ts         Gmail SMTP (nodemailer) or Resend
server/reap.ts          Live Reap adapter + local simulator
server/ai.ts            Budget-aware reward recommender (OpenAI with fallback)
server/merchants.ts     Catalogue: 2 real Reap products + simulator-only demo items
server/scoring.ts       Deterministic scoring and tie-breaks
server/legal.ts         TERMS_VERSION
server/db/              schema.ts, client.ts, migrate.ts
shared/                 activities.ts (sports list), pricing.ts ($–$$$$ bands)
src/App.tsx, api.ts     UI + typed API client;  src/legal.tsx  legal pages;  src/index.css  styles
drizzle/                0000–0004 SQL migrations
scripts/check-reap.mjs  read-only Reap connectivity check
tests/                  scoring, settle/lifecycle, privacy, auth, email
docs/                   PRODUCT_ASSESSMENT.md (Malcolm), UI previews, this file
```

### 3.2 Data model (Turso)

`users` (name, email, terms version/time, email-verified time) · `challenges` (name, invite code, duration, activity, is_public, status `draft|active|settled|cancelled`, winner/loser) · `participants` (max 2 per challenge) · `reward_choices` (lowest + best per player, price snapshot) · `payment_authorizations` (Reap enrolment ref + the player's spending cap; **no card data**) · `transactions` (one per purchase; unique idempotency key; status, amount, approval URL, failure reason, attempts) · `activity_logs` (simulated daily data) · `login_codes` (hashed one-time codes) · `sessions` (hashed tokens).

**Migrations:** `0000` base · `0001` activity · `0002` is_public · `0003` terms acceptance · `0004` accounts tables **+ a one-time `DELETE` of all earlier data** (already ran in production; harmless on a fresh DB).

### 3.3 API summary (all under `/api`)

Public: `GET /health`, `/config`, `/merchants`, `/lobby` · Auth: `POST /auth/request-code`, `/auth/verify`, `/auth/logout`, `/auth/logout-all`, `GET /auth/me` · Logged in: `GET /challenges/mine`, `POST /challenges`, `/join`, `/lobby/:id/join` · Members only: `GET /challenges/:id`, `POST /challenges/:id/{cancel, recommend, rewards, authorize, ceiling, enrollment-status, refresh-transactions, simulate-activity, settle}`.

---

## 4. Product rules (as implemented)

### 4.1 Scoring (deterministic: AI never decides winners)
Points per day = active minutes (capped at **90**) + **10** bonus if ≥ **30** minutes. Tie-breaks: more active days → more steps → a stable hash of the challenge id. Max possible = `durationDays × 100`. No weight-loss targets; daily cap discourages extreme effort.

### 4.2 Lifecycle
`draft` (waiting for a friend / rewards / card) → `active` (both players have locked rewards and enrolled a card **and** caps cover each other's best reward) → `settled` (winner/loser decided; two purchases created). A host can `cancel` only while `draft`.

### 4.3 Spending cap = the AI's budget
- The player sets a cap (S$) **first**. The AI suggests only items ≤ cap: a **low cap → a few cheap items**; a **high cap → many more items and premium ones ($$$$)**. The player can swap among alternatives.
- Server rules: best reward ≤ cap; payment can't be set up until rewards are locked and cap ≥ own best reward; **the challenge only starts when each player's cap ≥ the friend's best reward** (they may be asked to buy it). A cap can be raised before start.
- A cap too low for two rewards returns the minimum (e.g. "raise it to at least S$3.85").
- The final quote (shipping/tax) can exceed list price; checkout is then stopped with a clear reason.

### 4.4 Settlement
Loser pays for the winner's **best** reward; winner pays for the loser's **lowest**. Each purchase = own transaction, idempotent, retryable. Reap needs **per-purchase hosted approval** by each payer on the final day; the UI shows an "Approve payment" link and a "Refresh payment status" button.

### 4.5 Lobby
Public challenges with a free seat are listed (newest first, filter by activity). Seat claiming is a single atomic SQL statement. Private challenges never appear and are joinable only by invite link/code.

---

## 5. Accounts and security

- **Sign-up / log-in** with a **6-digit emailed code** (no passwords). Codes: hashed, expire in 10 min, single-use, max 5 wrong tries, ≤5 per hour per email, 30 s between *unused* codes.
- **Sessions:** random token in an **HttpOnly, SameSite=Lax, Secure (on Vercel)** cookie, 30 days; only a hash is stored. Log out / log out of all devices supported.
- **Authorisation is server-side.** The API ignores any user id from the browser; only members can read or change a challenge (others get "not found"); only the host can cancel; posts with a mismatched `Origin` are rejected.
- **Terms** accepted once at sign-up and recorded with version + timestamp.
- **Email providers:** Gmail SMTP via **app password** (preferred for now) or Resend (needs a verified domain). If neither is configured on Vercel, login returns "not set up" and leaks nothing.
- **⚠ Demo mode (`AUTH_DEV_CODE=true`)**: sign-in needs no email and no code, so **anyone can log in as any email**. It is **currently ON in production** (`/api/config` says `demo`). Fine for a controlled live demo; **must be turned off before real users.**

---

## 6. Payments (Reap): what is and isn't proven

| Step | Status |
|---|---|
| API key, `Reap-Version: 2025-02-14`, Singapore sandbox host | ✅ works (catalogue search 200; enrolment sessions created) |
| Create hosted card-enrolment session | ✅ returns a `sandbox.collect.prava.space` URL |
| Hosted card entry | ⚠ **needs a real passkey** (Visa FIDO). Headless browser and a virtual authenticator both failed ("Passkey Not Supported" / "Authentication Failed"). The owner reported enrolment worked in a real browser. |
| Product search → variant → **quote** → **checkout** → approval → `COMPLETED` | ❌ **never run end to end** |
| Mandates (automatic final-day charges) | ❌ **not available from Reap yet**; design avoids them |

**Assumptions to verify on the first real run** (all in `server/reap.ts`): Reap amounts are decimal major units (`"58.00"`); the first available search hit is the right variant (the exact **Navy / M** shorts need a pinned `variantId` in `server/merchants.ts`); merchants (Six Eleven, Kydra) are actually live in the sandbox; the HTTPS return URL flow (production has it).
Sandbox helpers: test cards (`4622 9431 2313 7797`, 12/27, CVC 640, OTP `456789`); `REAP_SIMULATE_COMPLETE=true` makes checkouts complete instantly (`X-Simulate-Checkout`).

**Catalogue reality:** only **two real purchasable products** exist (Six Eleven CocoCoast coconut water S$3.85, Kydra Axis Linerless Shorts S$58). Twelve **clearly-labelled demo items** (S$2.50–S$329) exist **only in the simulator** (or `ENABLE_DEMO_CATALOGUE=true`) so the cap behaviour is demonstrable. In live Reap mode the minimum cap is therefore **S$58**.

---

## 7. Configuration (names only)

Set in **Vercel → Settings → Environment Variables** (tick Production/Preview/Development; **redeploy** after changes). Never prefix with `VITE_`. Never commit `.env`.

| Variable | Needed? | Purpose |
|---|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | **Required** | Database. Missing URL → build error `ENOTFOUND turso_database_url-not-set.invalid`. |
| `OPENAI_API_KEY` | Optional | AI reward suggestions (falls back to cheapest/priciest picks). |
| `REAP_API_KEY` | For live payments | Absent → local simulator. `REAP_VERSION` (default `2025-02-14`), `REAP_BASE_URL` (default Singapore sandbox), `REAP_SIMULATE_COMPLETE` (sandbox shortcut), `APP_URL` (return URL; defaults to Vercel URL). |
| `AUTH_SECRET` | Required for **real** email login | 32+ random chars; hashes login codes. Not needed in demo mode. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | One email provider needed for real login | Gmail SMTP using a Google **app password** (needs 2-Step Verification). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Alternative provider | Needs a domain verified in Resend (cannot send from `@gmail.com`). |
| `AUTH_DEV_CODE` | **Demo only** | `true` = instant insecure sign-in. Remove after the demo. |
| `ENABLE_DEMO_CATALOGUE` | Optional | Show demo-only items in live Reap mode (checkout will fail for them). |

**Local run:** Node ≥ 22.9 · `npm install` · copy `.env.example` → `.env` (use `TURSO_DATABASE_URL=file:local.db` for an isolated DB) · `npm run db:migrate` · `npm run dev` (web :5173, API :8787) · `npm test`. With no email provider locally, sign-in shows/uses the code automatically.

---

## 8. Known issues, risks and open decisions

**Must fix before real users**
1. **Turn off demo mode**; set `AUTH_SECRET` and an email provider; verify a real sign-up email arrives (**unverified**: no real email has been sent yet).
2. **Legal pages are a draft.** Placeholders (UEN, registered address, DPO email, liability cap, retention periods) must be filled and the text **reviewed by Singapore counsel**. README previously described terms being accepted on create/join; that was replaced by sign-up acceptance (README corrected in this commit): **re-read the legal page wording for the same drift (unverified).**
3. **Gambling/lottery/payment-services question:** outcome-dependent purchases may fall under restricted categories; organiser/provider clearance needed. **No real-money staking, sandbox only.**
4. **Reap end-to-end** (section 6) is unproven; do a full real-browser run and pin the shorts `variantId`.
5. **Fitness data is simulated.** Real data needs verification, disputes, cancellation and consent. The "AI determines the results" label is marketing copy: scoring is deterministic (the UI adds a note saying AI only explains).

**Engineering debt**
- No CI: tests only run locally; Vercel builds but doesn't test. Add a GitHub Action (`tsc`, `vitest`, `vite build`).
- 500 responses include a truncated `detail` string (POC debugging): remove for production.
- No rate limiting beyond login codes; no account deletion / data export (PDPA).
- Challenges are strictly 1-vs-1 (payments are built around two people).
- Live catalogue is two products; wiring Reap product search (with price filters from the cap) is the natural next step but needs a real response to code against.
- UI tests are manual/Playwright-in-session only; none committed.

**Process lessons (please keep)**
- **Four sessions pushing to one branch caused merge conflicts**, and one conflict resolution dropped a CSS brace and briefly broke the build (`a2fd683`). Use one integrator, pull before pushing, and run `tsc && vitest && vite build` *after* every merge.
- `main` was deleted; the feature branch is the default. Consider re-creating `main` with branch protection and a PR flow.
- Vercel gotchas already hit: extensionless ESM imports crash functions (keep `.js` in server imports); Drizzle prints bare `id` in sub-selects, so qualify columns (`challenges.id`); Vite's dev proxy rewrites `Host` (fixed with `xfwd: true`); `AUTH_*`/env changes need a **redeploy**.
- Session cookies and `Origin` checks only work same-origin: keep UI and API on one Vercel project.

---

## 9. Suggested next steps (priority order)

1. **Run the full Reap flow in a real browser** (two accounts, enrol, simulate, settle, approve, refresh). Fix whatever the first real quote/checkout reveals (amount units, variant, merchant availability).
2. **Production auth:** set up the Gmail app password (or Resend + domain), `AUTH_SECRET`, send a real code, then **remove `AUTH_DEV_CODE`**.
3. **Counsel review** of the legal pages; fill placeholders; confirm the gambling question.
4. **Add CI** and branch protection; re-create `main`.
5. **Reap product search** to build a real catalogue within the cap (and pin variants).
6. Real fitness integrations, disputes/cancellation, account deletion/export, rate limiting.
7. Business model (owner asked to "make money"): affiliate/merchant fees on fulfilled rewards, sponsored rewards, premium tiers: *avoid* any real-money staking model until legal sign-off.

---

## 10. Five-minute live-demo script

1. Open https://fitstake-eta.vercel.app → **Sign up** (name, email, tick Terms) → in instantly (demo mode).
2. **Create challenge** (pick an activity, 1–2 days to keep it short; leave "list in lobby" on).
3. In a second browser/incognito window: sign up as someone else → **Challenges** tab → **Join**.
4. Each player: set a **spending cap**, tap **Suggest**, swap picks if desired, **Lock in rewards**, then **enrol card** (real passkey device needed on Reap's page, or run the demo in simulator mode).
5. **Simulate activity → Simulate final day → settle.** Show the winner, the two purchases, and **Approve payment**.
6. Optional: show **Cancel challenge**, the **How it works** tab, and the **Privacy/Terms** footer links.

_Last verified: `tsc` clean · 42/42 tests · `vite build` OK · production `/api/health` OK._
