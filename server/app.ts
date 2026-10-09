import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { recommend } from "./ai.js";
import { db } from "./db/client.js";
import { ACTIVITY_IDS, DEFAULT_ACTIVITY } from "../shared/activities.js";
import { users } from "./db/schema.js";
import { CATALOGUE } from "./merchants.js";
import * as svc from "./service.js";

const person = z.object({
  name: z.string().min(1).max(60),
  email: z.string().email(),
});
const ids = z.object({ userId: z.string().min(1) });

export const app = new Hono().basePath("/api");

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
app.get("/merchants", (c) => c.json(CATALOGUE));

app.post(
  "/challenges",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(80),
      creator: person,
      // Any length from a single day up to a year.
      durationDays: z.number().int().min(1).max(365).default(30),
      activity: z.enum(ACTIVITY_IDS).default(DEFAULT_ACTIVITY),
    }),
  ),
  async (c) => c.json(await svc.createChallenge(db, c.req.valid("json")), 201),
);

app.post(
  "/join",
  zValidator("json", person.extend({ inviteCode: z.string().min(4).max(16) })),
  async (c) => {
    const { inviteCode, ...p } = c.req.valid("json");
    return c.json(await svc.joinChallenge(db, inviteCode, p));
  },
);

app.get("/challenges/:id", async (c) =>
  c.json(await svc.getState(db, c.req.param("id"))),
);

app.post(
  "/challenges/:id/recommend",
  zValidator(
    "json",
    z.object({ preferences: z.string().max(500).default("") }),
  ),
  async (c) => c.json(await recommend(c.req.valid("json").preferences)),
);

app.post(
  "/challenges/:id/rewards",
  zValidator("json", ids.extend({ lowestId: z.string(), bestId: z.string() })),
  async (c) => {
    const b = c.req.valid("json");
    await svc.lockRewards(
      db,
      c.req.param("id"),
      b.userId,
      b.lowestId,
      b.bestId,
    );
    return c.json(await svc.getState(db, c.req.param("id")));
  },
);

app.post(
  "/challenges/:id/authorize",
  zValidator(
    "json",
    ids.extend({
      spendingCeilingCents: z.number().int().min(100).max(100_000),
      returnUrl: z.string().url(),
    }),
  ),
  async (c) => {
    const b = c.req.valid("json");
    const { approvalUrl } = await svc.authorize(
      db,
      c.req.param("id"),
      b.userId,
      b.spendingCeilingCents,
      b.returnUrl,
    );
    return c.json({
      approvalUrl,
      state: await svc.getState(db, c.req.param("id")),
    });
  },
);

app.post(
  "/challenges/:id/enrollment-status",
  zValidator("json", ids),
  async (c) => {
    await svc.refreshEnrollment(
      db,
      c.req.param("id"),
      c.req.valid("json").userId,
    );
    return c.json(await svc.getState(db, c.req.param("id")));
  },
);

app.post("/challenges/:id/refresh-transactions", async (c) => {
  await svc.refreshTransactions(db, c.req.param("id"));
  return c.json(await svc.getState(db, c.req.param("id")));
});

// POC only: simulated fitness data and the "simulate final day" action.
app.post("/challenges/:id/simulate-activity", async (c) => {
  await svc.simulateActivity(db, c.req.param("id"));
  return c.json(await svc.getState(db, c.req.param("id")));
});

app.post("/challenges/:id/settle", async (c) => {
  await svc.settle(db, c.req.param("id"));
  return c.json(await svc.getState(db, c.req.param("id")));
});
