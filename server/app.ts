import { Hono } from "hono";
import { destroyAllSessions, destroySession, requestLoginCode, verifyLoginCode } from "./auth.js";
import { clearSessionCookie, requireUser, sameOrigin, sessionToken, setSessionCookie, type Env } from "./session.js";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { recommend } from "./ai.js";
import { db } from "./db/client.js";
import { ACTIVITY_IDS, DEFAULT_ACTIVITY } from "../shared/activities.js";
import { users } from "./db/schema.js";
import { getCatalogue } from "./merchants.js";
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
