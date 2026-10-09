import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { TERMS_VERSION } from "../server/legal";

process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "fitstake-privacy-")), "t.db")}`;
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

describe("terms acceptance and personal data exposure", () => {
  it("records the accepted terms version and time on create and join", async () => {
    const email = `c${crypto.randomUUID()}@x.io`;
    const a = await svc.createChallenge(db, { name: "t", creator: { name: "Ann", email } });
    const [creator] = await db.select().from(schema.users).where(eq(schema.users.id, a.userId));
    expect(creator!.termsVersion).toBe(TERMS_VERSION);
    expect(creator!.termsAcceptedAt).toBeInstanceOf(Date);

    const b = await svc.joinChallenge(db, a.inviteCode, { name: "Ben", email: `j${crypto.randomUUID()}@x.io` });
    const [joiner] = await db.select().from(schema.users).where(eq(schema.users.id, b.userId));
    expect(joiner!.termsVersion).toBe(TERMS_VERSION);
  });

  it("does not expose participant emails in the challenge state", async () => {
    const a = await svc.createChallenge(db, { name: "t", creator: { name: "Cy", email: `e${crypto.randomUUID()}@x.io` } });
    await svc.joinChallenge(db, a.inviteCode, { name: "Di", email: `f${crypto.randomUUID()}@x.io` });
    const state = await svc.getState(db, a.challengeId);
    expect(state.participants).toHaveLength(2);
    for (const p of state.participants) {
      expect(Object.keys(p.user).sort()).toEqual(["id", "name"]);
    }
    expect(JSON.stringify(state)).not.toContain("@x.io");
  });
});
