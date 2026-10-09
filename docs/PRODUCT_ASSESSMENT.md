# FitStake product assessment

## Recommended solution

Position FitStake as a shared habit challenge: two friends, 30 days, transparent activity scoring, and two meaningful rewards each. Lead with showing up together. Fitness consistency is the primary product value; the reward purchase is the closing moment.

Keep the hackathon MVP narrow: create/join, lock the supported low and best rewards, set a spending ceiling, enrol through Reap, simulate activity, show a deterministic result, and prepare two separately approved sandbox purchases. The loser buys the winner's best reward; the winner buys the loser's low reward. No escrow or guaranteed future debit is implied.

The existing React/Vite, Hono, Drizzle, and Turso stack is suitable for this scope. The local database keeps development isolated from shared Turso data. OpenAI can explain catalogue recommendations, while scoring, permission checks, budgets, and payment decisions remain deterministic. With only two supported products, AI currently personalises the explanation rather than offering a broad product selection.

## Implemented experience

- Responsive cream, forest, and lime visual system, with reusable panels, typography, form controls, and focus states.
- A clear landing page, illustrated reward preview, and create/join form with labelled fields and native validation.
- Scoring details available before joining; daily minutes are capped and there are no weight-loss targets.
- Challenge milestones, next-step summary, participant cards, locked rewards, and scored leaderboard bars.
- Reward recommendation cards identify AI output versus catalogue fallback.
- Explicit local simulator versus Reap sandbox status, and different enrolment copy in each mode.
- Refresh control for updates from a friend; recoverable loading/error state; provider failures handled through the shared error banner.
- Hosted enrolment uses a visible link rather than an asynchronous popup that browsers may block.
- Local server and migrations load a gitignored .env. No credentials or card details are embedded in browser code.
- Reap Singapore sandbox host and documented AVAILABLE_ONLY product filter corrected.

## Validation

The production build and five existing scoring/settlement tests pass. Browser verification covered creating a challenge, joining as the second participant, selecting and locking rewards, simulating enrolment for both, activating the challenge, generating activity, and settling into two completed local simulated transactions. Desktop and mobile layouts were inspected; the mobile dashboard had no horizontal overflow.

A separate authenticated, read-only Reap catalogue search returned HTTP 200 and one KYDRA product. This confirms key and catalogue access, not hosted enrolment or payment completion. The final preview is configured for Reap sandbox; the completed demo challenge was exercised in local simulator mode before that configuration was loaded.

## Remaining work before a public pilot

1. Add real identity and server-side session authorisation. The current POC trusts a submitted user ID and lets someone rejoin by email. Every challenge read and mutation must verify membership; payment actions must verify the authenticated payer. An invite code must not serve as payment authority.
2. Add explicit rule/budget acceptance records, timestamps, and an audit trail. Store the displayed ceiling for review. A production challenge needs start/end dates and a settlement deadline, rather than only a simulation button.
3. Verify Reap hosted enrolment and checkout with an HTTPS return URL and a complete test card. Current Reap setup documentation requires HTTPS. Do not infer missing digits from the supplied masked card. Verify variant size/colour, amount units, quote expiry, shipping, provider errors, and completed-order responses before calling the integration end-to-end verified.
4. Pin the exact purchasable reward variant. The inherited adapter searches for a merchant match and uses its preview variant; this alone does not guarantee Navy / M. Never substitute another product silently.
5. Add payment webhook verification or robust reconciliation, expiry handling, retry visibility, and a persistent way to resume hosted enrolment after reload. Preserve settlement idempotency and validate a fresh all-in quote against the payer's ceiling.
6. Add verified fitness data, disputes, cancellation, and consent before a real challenge. Do not compare unsafe weight-loss targets or let AI decide the winner.
7. Confirm organiser/provider acceptance of outcome-linked rewards before enabling real purchases. Keep this build in sandbox. An alternative pilot can reward each participant for their own completion with sponsor-funded benefits.
8. Expand the supported reward catalogue before claiming deeply personalised AI selection. Add opted-in preferences and bounded explanations. Use rotated OpenAI/Turso keys for any later connected deployment.

## Integration references

- Reap setup and HTTPS return URL: https://docs.reap.global/agentic-payments/setup
- Singapore sandbox and product filter: https://docs.reap.global/api-reference/agentic/search-products
- Hosted approval model: https://docs.reap.global/agentic-payments/overview

The supplied concept and tech-stack PDFs informed scope. Document instructions were treated as product background, not as permission to publish or transact.
