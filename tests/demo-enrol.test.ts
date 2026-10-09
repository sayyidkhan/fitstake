import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "fitstake-")), "t.db")}`;
delete process.env.TURSO_AUTH_TOKEN;
// Explicitly disable auto-approve so the pending -> hosted demo page -> active
// flow is exercised.
process.env.REAP_SIMULATE_AUTO_APPROVE = "false";

let svc: typeof import("../server/service");
let db: typeof import("../server/db/client").db;
let reap: typeof import("../server/reap");

beforeAll(async () => {
  ({ db } = await import("../server/db/client"));
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(db, { migrationsFolder: "./drizzle" });
  svc = await import("../server/service");
  reap = await import("../server/reap");
});

describe("demo enrolment flow", () => {
  it("returns a local demo enrolment page and activates after the page is completed", async () => {
    const a = await svc.createChallenge(db, {
      name: "demo",
      creator: { name: "A", email: `a${crypto.randomUUID()}@x.io` },
    });
    const b = await svc.joinChallenge(db, a.inviteCode, {
      name: "B",
      email: `b${crypto.randomUUID()}@x.io`,
    });

    for (const u of [a.userId, b.userId]) {
      await svc.lockRewards(
        db,
        a.challengeId,
        u,
        "sixeleven-cococoast-500ml",
        "kydra-axis-linerless-shorts-navy-m",
        10_000,
      );
      const res = await svc.authorize(
        db,
        a.challengeId,
        u,
        10_000,
        "http://localhost:5173",
      );
      expect(res.approvalUrl).toMatch(/\/api\/demo\/enrol\//);
      const id = decodeURIComponent(
        res.approvalUrl!.split("/demo/enrol/")[1].split("?")[0],
      );
      expect(reap.isDemoEnrollment(id)).toBe(true);
      reap.activateDemoEnrollment(id);
      await svc.refreshEnrollment(db, a.challengeId, u);
    }

    const state = await svc.getState(db, a.challengeId);
    expect(state.challenge.status).toBe("active");
    expect(
      state.participants.every((p) => p.authorised && !p.enrolmentPending),
    ).toBe(true);
  });
});
