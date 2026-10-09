import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "fitstake-")), "t.db")}`;
delete process.env.TURSO_AUTH_TOKEN;

let svc: typeof import("../server/service");
let db: typeof import("../server/db/client").db;
let schema: typeof import("../server/db/schema");

beforeAll(async () => {
  ({ db } = await import("../server/db/client"));
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(db, { migrationsFolder: "./drizzle" });
  svc = await import("../server/service");
  schema = await import("../server/db/schema");
});

async function setup() {
  const a = await svc.createChallenge(db, { name: "t", creator: { name: "Sarah", email: `s${crypto.randomUUID()}@x.io` } });
  const b = await svc.joinChallenge(db, a.inviteCode, { name: "John", email: `j${crypto.randomUUID()}@x.io` });
  for (const u of [a.userId, b.userId]) {
    await svc.lockRewards(db, a.challengeId, u, "sixeleven-cococoast-500ml", "kydra-axis-linerless-shorts-navy-m");
    await svc.authorize(db, a.challengeId, u, 10_000, "http://localhost");
  }
  return a.challengeId;
}

describe("challenge lifecycle", () => {
  it("activates, settles into two transactions, and is idempotent", async () => {
    const id = await setup();
    expect((await svc.getState(db, id)).challenge.status).toBe("active");
    await svc.simulateActivity(db, id);
    await svc.settle(db, id);
    await svc.settle(db, id);
    await Promise.all([svc.settle(db, id), svc.settle(db, id)]);
    const s = await svc.getState(db, id);
    expect(s.challenge.status).toBe("settled");
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions.every((t) => t.status === "completed")).toBe(true);
    const amounts = s.transactions.map((t) => t.amountCents).sort((x, y) => x! - y!);
    expect(amounts).toEqual([385, 5800]);
    // loser pays winner's best reward
    const best = s.transactions.find((t) => t.amountCents === 5800)!;
    expect(best.payerUserId).toBe(s.challenge.loserUserId);
  });

  it("fails checkout when the quote exceeds the spending ceiling", async () => {
    const a = await svc.createChallenge(db, { name: "t", creator: { name: "A", email: `a${crypto.randomUUID()}@x.io` } });
    const b = await svc.joinChallenge(db, a.inviteCode, { name: "B", email: `b${crypto.randomUUID()}@x.io` });
    for (const u of [a.userId, b.userId]) {
      await svc.lockRewards(db, a.challengeId, u, "sixeleven-cococoast-500ml", "kydra-axis-linerless-shorts-navy-m");
      await svc.authorize(db, a.challengeId, u, 500, "http://localhost"); // S$5 ceiling
    }
    await svc.simulateActivity(db, a.challengeId);
    await svc.settle(db, a.challengeId);
    const s = await svc.getState(db, a.challengeId);
    const big = s.transactions.find((t) => t.payerUserId === s.challenge.loserUserId)!;
    expect(big.status).toBe("failed");
    expect(big.failureReason).toMatch(/ceiling/);
    expect(schema).toBeDefined();
  });
});

describe("challenge length", () => {
  it("supports a single-day challenge end to end", async () => {
    const a = await svc.createChallenge(db, { name: "1d", durationDays: 1, creator: { name: "A", email: `a${crypto.randomUUID()}@x.io` } });
    const b = await svc.joinChallenge(db, a.inviteCode, { name: "B", email: `b${crypto.randomUUID()}@x.io` });
    for (const u of [a.userId, b.userId]) {
      await svc.lockRewards(db, a.challengeId, u, "sixeleven-cococoast-500ml", "kydra-axis-linerless-shorts-navy-m");
      await svc.authorize(db, a.challengeId, u, 10_000, "http://localhost");
    }
    await svc.simulateActivity(db, a.challengeId);
    const s0 = await svc.getState(db, a.challengeId);
    expect(s0.challenge.durationDays).toBe(1);
    expect(s0.leaderboard.every((l) => l.adherentDays <= 1)).toBe(true);
    await svc.settle(db, a.challengeId);
    expect((await svc.getState(db, a.challengeId)).transactions).toHaveLength(2);
  });

  it("defaults to 30 days", async () => {
    const a = await svc.createChallenge(db, { name: "d", creator: { name: "A", email: `a${crypto.randomUUID()}@x.io` } });
    expect((await svc.getState(db, a.challengeId)).challenge.durationDays).toBe(30);
  });
});

describe("activity type", () => {
  it("stores the activity and tailors simulated steps", async () => {
    const mk = async (activity?: string) => {
      const a = await svc.createChallenge(db, { name: "a", activity, creator: { name: "A", email: `a${crypto.randomUUID()}@x.io` } });
      const b = await svc.joinChallenge(db, a.inviteCode, { name: "B", email: `b${crypto.randomUUID()}@x.io` });
      for (const u of [a.userId, b.userId]) {
        await svc.lockRewards(db, a.challengeId, u, "sixeleven-cococoast-500ml", "kydra-axis-linerless-shorts-navy-m");
        await svc.authorize(db, a.challengeId, u, 10_000, "http://localhost");
      }
      await svc.simulateActivity(db, a.challengeId);
      return svc.getState(db, a.challengeId);
    };
    const swim = await mk("swimming");
    expect(swim.challenge.activity).toBe("swimming");
    expect(swim.leaderboard.every((l) => l.totalSteps === 0)).toBe(true);
    const run = await mk("running");
    expect(run.leaderboard.every((l) => l.totalSteps > 1000)).toBe(true);
    expect((await mk()).challenge.activity).toBe("any");
  });

  it("has unique ids and a valid default", async () => {
    const { ACTIVITIES, DEFAULT_ACTIVITY } = await import("../shared/activities");
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
    expect(ACTIVITIES.some((a) => a.id === DEFAULT_ACTIVITY)).toBe(true);
  });
});

describe("lobby (server browser)", () => {
  const email = (p: string) => `${p}${crypto.randomUUID()}@x.io`;

  it("lists open public challenges and hides private, full and started ones", async () => {
    const open = await svc.createChallenge(db, { name: "open-" + crypto.randomUUID(), activity: "swimming", creator: { name: "Host One", email: email("h") } });
    const priv = await svc.createChallenge(db, { name: "priv-" + crypto.randomUUID(), isPublic: false, creator: { name: "H", email: email("h") } });
    const full = await svc.createChallenge(db, { name: "full-" + crypto.randomUUID(), creator: { name: "H", email: email("h") } });
    await svc.joinChallenge(db, full.inviteCode, { name: "J", email: email("j") });

    const ids = (await svc.listLobby(db)).map((c) => c.id);
    expect(ids).toContain(open.challengeId);
    expect(ids).not.toContain(priv.challengeId);
    expect(ids).not.toContain(full.challengeId);

    const entry = (await svc.listLobby(db)).find((c) => c.id === open.challengeId)!;
    expect(entry).toMatchObject({ activity: "swimming", host: "Host", players: 1, maxPlayers: 2 });
    expect(JSON.stringify(entry)).not.toMatch(/@|inviteCode/);
    expect((await svc.listLobby(db, "running")).map((c) => c.id)).not.toContain(open.challengeId);
  });

  it("joining from the lobby fills the seat and removes it from the list", async () => {
    const c = await svc.createChallenge(db, { name: "pick-" + crypto.randomUUID(), creator: { name: "Host", email: email("h") } });
    await svc.joinPublicChallenge(db, c.challengeId, { name: "Guest", email: email("g") });
    expect((await svc.listLobby(db)).map((x) => x.id)).not.toContain(c.challengeId);
    await expect(svc.joinPublicChallenge(db, c.challengeId, { name: "Late", email: email("l") })).rejects.toThrow(/full/);
  });

  it("cannot join a private challenge by id, only by invite code", async () => {
    const c = await svc.createChallenge(db, { name: "p", isPublic: false, creator: { name: "Host", email: email("h") } });
    await expect(svc.joinPublicChallenge(db, c.challengeId, { name: "G", email: email("g") })).rejects.toThrow(/not found/i);
    await expect(svc.joinChallenge(db, c.inviteCode, { name: "G", email: email("g") })).resolves.toBeTruthy();
  });

  it("never overfills when several people join at once", async () => {
    const c = await svc.createChallenge(db, { name: "race-" + crypto.randomUUID(), creator: { name: "Host", email: email("h") } });
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => svc.joinPublicChallenge(db, c.challengeId, { name: `G${i}`, email: email("g") })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await svc.getState(db, c.challengeId)).participants).toHaveLength(2);
  });
});
