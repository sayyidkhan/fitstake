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
    await svc.authorize(db, a.challengeId, u, 10_000);
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
    expect(s.transactions.every((t) => t.status === "checkout_opened")).toBe(true);
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
      await svc.authorize(db, a.challengeId, u, 500); // S$5 ceiling
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
