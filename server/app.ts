import { Hono } from "hono";
import { destroyAllSessions, destroySession, devCodeAllowed, requestLoginCode, verifyLoginCode } from "./auth.js";
import { clearSessionCookie, requireUser, sameOrigin, sessionToken, setSessionCookie, type Env } from "./session.js";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { recommend } from "./ai.js";
import { db } from "./db/client.js";
import { ACTIVITY_IDS, DEFAULT_ACTIVITY } from "../shared/activities.js";
import { users } from "./db/schema.js";
import { getCatalogue } from "./merchants.js";
import { activateDemoEnrollment } from "./reap.js";
import * as svc from "./service.js";

const email = z.string().trim().email().max(254);
const cents = z.number().int().min(100).max(100_000);

export const app = new Hono<Env>().basePath("/api");
app.use("*", sameOrigin);

app.onError((err, c) => {
  if (err instanceof svc.HttpError)
    return c.json({ error: err.message }, err.status);
  console.error(err);
  const detail = err instanceof Error ? err.message.slice(0, 200) : "";
  return c.json({ error: "Internal error", detail }, 500);
});

app.get("/health", async (c) => {
  try {
    const rows = await db.select({ id: users.id }).from(users).limit(1);
    return c.json({ ok: true, db: "ok", users: rows.length });
  } catch (err) {
    console.error("health check failed", err);
    return c.json(
      {
        ok: false,
        db: err instanceof Error ? err.message.slice(0, 300) : "error",
      },
      503,
    );
  }
});
app.get("/config", (c) =>
  c.json({
    // "demo": sign-in needs no email (codes are filled in automatically). Never enable for real users.
    auth: devCodeAllowed() ? "demo" : "email",
    payments: !process.env.REAP_API_KEY
      ? "simulated"
      : [
            "https://sandbox.api.reap.global",
            "https://sg.sandbox.api.reap.global",
          ].includes(
            process.env.REAP_BASE_URL ?? "https://sg.sandbox.api.reap.global",
          )
        ? "reap_sandbox"
        : "unavailable",
  }),
);
app.get("/merchants", (c) => c.json(getCatalogue()));

// ---------- Accounts ----------
app.post("/auth/request-code", zValidator("json", z.object({ email })), async (c) => {
  const { devCode } = await requestLoginCode(db, c.req.valid("json").email);
  // Same answer whether or not the email has an account, so accounts can't be enumerated.
  return c.json({ ok: true, ...(devCode ? { devCode } : {}) });
});

app.post(
  "/auth/verify",
  zValidator(
    "json",
    z.object({
      email,
      code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
      name: z.string().trim().min(1).max(60).optional(),
      acceptedTerms: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const b = c.req.valid("json");
    const { token, user } = await verifyLoginCode(db, { ...b, userAgent: c.req.header("user-agent") });
    setSessionCookie(c, token);
    return c.json({ user });
  },
);

app.get("/auth/me", requireUser, (c) => c.json({ user: c.get("user") }));

app.post("/auth/logout", async (c) => {
  const token = sessionToken(c);
  if (token) await destroySession(db, token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.post("/auth/logout-all", requireUser, async (c) => {
  await destroyAllSessions(db, c.get("user").id);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

// ---------- Challenges ----------
app.get("/lobby", zValidator("query", z.object({ activity: z.enum(ACTIVITY_IDS).optional() })), async (c) =>
  c.json(await svc.listLobby(db, c.req.valid("query").activity)),
);

app.get("/challenges/mine", requireUser, async (c) => c.json(await svc.listMine(db, c.get("user").id)));

app.post(
  "/challenges",
  requireUser,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(80),
      // Any length from a single day up to a year.
      durationDays: z.number().int().min(1).max(365).default(30),
      activity: z.enum(ACTIVITY_IDS).default(DEFAULT_ACTIVITY),
      isPublic: z.boolean().default(true),
    }),
  ),
  async (c) => {
    const u = c.get("user");
    return c.json(await svc.createChallenge(db, { ...c.req.valid("json"), creator: { name: u.name, email: u.email } }), 201);
  },
);

app.post("/join", requireUser, zValidator("json", z.object({ inviteCode: z.string().min(4).max(16) })), async (c) => {
  const u = c.get("user");
  return c.json(await svc.joinChallenge(db, c.req.valid("json").inviteCode, { name: u.name, email: u.email }));
});

app.post("/lobby/:id/join", requireUser, async (c) => {
  const u = c.get("user");
  return c.json(await svc.joinPublicChallenge(db, c.req.param("id"), { name: u.name, email: u.email }));
});

// Everything below is for members of the challenge only.
const member = async (c: { req: { param(k: string): string }; get(k: "user"): { id: string } }) => {
  const id = c.req.param("id");
  await svc.assertMember(db, id, c.get("user").id);
  return id;
};

app.get("/challenges/:id", requireUser, async (c) => c.json(await svc.getState(db, await member(c))));

app.post("/challenges/:id/cancel", requireUser, async (c) => {
  const id = await member(c);
  await svc.cancelChallenge(db, id, c.get("user").id);
  return c.json(await svc.getState(db, id));
});

app.post(
  "/challenges/:id/recommend",
  requireUser,
  zValidator("json", z.object({ preferences: z.string().max(500).default(""), budgetCents: cents })),
  async (c) => {
    await member(c);
    const b = c.req.valid("json");
    return c.json(await recommend(b.preferences, b.budgetCents));
  },
);

app.post(
  "/challenges/:id/rewards",
  requireUser,
  zValidator("json", z.object({ lowestId: z.string(), bestId: z.string(), budgetCents: cents })),
  async (c) => {
    const id = await member(c);
    const b = c.req.valid("json");
    await svc.lockRewards(db, id, c.get("user").id, b.lowestId, b.bestId, b.budgetCents);
    return c.json(await svc.getState(db, id));
  },
);

app.post(
  "/challenges/:id/authorize",
  requireUser,
  zValidator("json", z.object({ spendingCeilingCents: cents, returnUrl: z.string().url() })),
  async (c) => {
    const id = await member(c);
    const b = c.req.valid("json");
    const { approvalUrl } = await svc.authorize(db, id, c.get("user").id, b.spendingCeilingCents, b.returnUrl);
    return c.json({ approvalUrl, state: await svc.getState(db, id) });
  },
);

app.post("/challenges/:id/ceiling", requireUser, zValidator("json", z.object({ spendingCeilingCents: cents })), async (c) => {
  const id = await member(c);
  await svc.updateCeiling(db, id, c.get("user").id, c.req.valid("json").spendingCeilingCents);
  return c.json(await svc.getState(db, id));
});

app.post("/challenges/:id/enrollment-status", requireUser, async (c) => {
  const id = await member(c);
  await svc.refreshEnrollment(db, id, c.get("user").id);
  return c.json(await svc.getState(db, id));
});

app.post("/challenges/:id/refresh-transactions", requireUser, async (c) => {
  const id = await member(c);
  await svc.refreshTransactions(db, id);
  return c.json(await svc.getState(db, id));
});

// POC only: simulated fitness data and the "simulate final day" action.
app.post("/challenges/:id/simulate-activity", requireUser, async (c) => {
  const id = await member(c);
  await svc.simulateActivity(db, id);
  return c.json(await svc.getState(db, id));
});

app.post("/challenges/:id/settle", requireUser, async (c) => {
  const id = await member(c);
  await svc.settle(db, id);
  return c.json(await svc.getState(db, id));
});

// Demo-only hosted card enrolment page, used when REAP_API_KEY is not set.
// It mirrors the real Reap flow so the full "Prepare -> hosted page -> check status"
// workflow can be demonstrated without touching live payment APIs.
type DemoCard = { name: string; number: string; expiry: string; cvv: string };
const DEMO_CARDS: DemoCard[] = [
  { name: "Demo Visa success", number: "4111111111111111", expiry: "12/30", cvv: "323" },
  { name: "Demo Mastercard success", number: "5555555555554444", expiry: "12/30", cvv: "323" },
  { name: "Your test card", number: "62293123261720", expiry: "12/30", cvv: "323" },
];

app.get("/demo/enrol/:id", (c) => {
  const returnUrl = c.req.query("returnUrl") ?? "/";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FitStake demo card enrolment</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f5f7f2;
      color: #182a1d;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    main {
      max-width: 420px;
      margin: 40px auto;
      background: #fff;
      border: 1px solid #dbe4d7;
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 4px 24px rgba(24, 42, 29, 0.06);
    }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .badge {
      display: inline-block;
      background: #eef5d6;
      color: #3f4d1a;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 16px;
    }
    p { color: #4a5c4f; margin: 0 0 20px; }
    label { display: block; font-size: 13px; font-weight: 600; margin: 0 0 6px; color: #314036; }
    input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #c9d4c4;
      border-radius: 12px;
      font-size: 16px;
      margin-bottom: 18px;
      background: #f9fbf8;
    }
    input[readonly] { background: #eef5d6; color: #3f4d1a; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    button {
      width: 100%;
      padding: 14px;
      border: 0;
      border-radius: 12px;
      background: #d3e88b;
      color: #1c2605;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #c8dc7e; }
    .notice {
      background: #f5f7f2;
      border: 1px solid #dbe4d7;
      border-radius: 12px;
      padding: 14px;
      font-size: 13px;
      color: #4a5c4f;
      margin-bottom: 22px;
    }
    select {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #c9d4c4;
      border-radius: 12px;
      font-size: 16px;
      margin-bottom: 18px;
      background: #f9fbf8;
    }
    .small { font-size: 12px; color: #6e7f72; margin-top: 18px; text-align: center; }
  </style>
</head>
<body>
  <main>
    <span class="badge">Demo only · no real charge</span>
    <h1>Enrol your card</h1>
    <p>This is a local simulator page. The real FitStake flow redirects to Reap’s hosted sandbox instead.</p>
    <div class="notice">
      <b>Saved demo cards</b><br />
      Pick a saved test card below, or type your own — this simulator accepts any values.
    </div>
    <label for="saved-card">Use a saved demo card</label>
    <select id="saved-card" aria-label="Saved demo card">
      ${DEMO_CARDS.map((card, i) => `<option value="${i}">${card.name}</option>`).join("\n      ")}
    </select>
    <form method="post" action="/api/demo/enrol/${encodeURIComponent(c.req.param("id"))}?returnUrl=${encodeURIComponent(returnUrl)}">
      <label for="card">Card number</label>
      <input id="card" name="card" value="${DEMO_CARDS[0].number}" />

      <div class="row">
        <div>
          <label for="expiry">Expiry</label>
          <input id="expiry" name="expiry" value="${DEMO_CARDS[0].expiry}" />
        </div>
        <div>
          <label for="cvv">CVV</label>
          <input id="cvv" name="cvv" value="${DEMO_CARDS[0].cvv}" />
        </div>
      </div>

      <button type="submit">Complete demo enrolment</button>
    </form>
    <p class="small">Card details are not stored or validated in demo mode.</p>
  </main>
  <script>
    const cards = ${JSON.stringify(DEMO_CARDS)};
    const select = document.getElementById('saved-card');
    function fill(i) {
      const c = cards[i];
      document.getElementById('card').value = c.number;
      document.getElementById('expiry').value = c.expiry;
      document.getElementById('cvv').value = c.cvv;
    }
    select.addEventListener('change', (e) => fill(e.target.value));
  </script>
</body>
</html>`;
  return c.html(html);
});

app.post("/demo/enrol/:id", (c) => {
  activateDemoEnrollment(c.req.param("id"));
  const returnUrl = c.req.query("returnUrl");
  return c.redirect(returnUrl && returnUrl.startsWith("http") ? returnUrl : "/");
});
