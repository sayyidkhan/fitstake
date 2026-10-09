import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "fitstake-auth-")), "t.db")}`;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.RESEND_API_KEY;
delete process.env.VERCEL;

let app: typeof import("../server/app").app;
let db: typeof import("../server/db/client").db;
let schema: typeof import("../server/db/schema");

beforeAll(async () => {
  ({ db } = await import("../server/db/client"));
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(db, { migrationsFolder: "./drizzle" });
  ({ app } = await import("../server/app"));
  schema = await import("../server/db/schema");
});

type Opts = { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> };
const call = (path: string, o: Opts = {}) =>
  app.request(`/api${path}`, {
    method: o.method ?? (o.body ? "POST" : "GET"),
    headers: { ...(o.body ? { "content-type": "application/json" } : {}), ...(o.cookie ? { cookie: o.cookie } : {}), ...o.headers },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
const json = async (r: Response) => (await r.json()) as Record<string, any>;
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0]!;
const uniq = (p: string) => `${p}${crypto.randomUUID().slice(0, 8)}@example.com`;

// Signs up a new account through the real endpoints and returns its session cookie.
async function signUp(name: string, email = uniq("u")) {
  const req = await json(await call("/auth/request-code", { body: { email } }));
  const res = await call("/auth/verify", { body: { email, code: req.devCode, name, acceptedTerms: true } });
  expect(res.status).toBe(200);
  return { email, cookie: cookieOf(res), user: (await json(res)).user as { id: string; name: string } };
}

describe("sign up and sessions", () => {
  it("creates an account with a verified email, accepted terms and a secure session cookie", async () => {
    const email = uniq("new");
    const r = await call("/auth/request-code", { body: { email } });
    const { devCode } = await json(r);
    expect(devCode).toMatch(/^\d{6}$/);

    const res = await call("/auth/verify", { body: { email, code: devCode, name: "Sarah Tan", acceptedTerms: true } });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/fs_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const me = await json(await call("/auth/me", { cookie: cookieOf(res) }));
    expect(me.user).toMatchObject({ name: "Sarah Tan", email });
    const [row] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    expect(row!.emailVerifiedAt).toBeInstanceOf(Date);
    expect(row!.termsAcceptedAt).toBeInstanceOf(Date);
    expect(row!.termsVersion).toBeTruthy();
  });

  it("only stores a hash of the code and a hash of the session token", async () => {
    const { email, cookie } = await signUp("Hash Check");
    const [code] = await db.select().from(schema.loginCodes).where(eq(schema.loginCodes.email, email));
    expect(code!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    const token = cookie.split("=")[1]!;
    const sessions = await db.select().from(schema.sessions);
    expect(sessions.some((s) => s.tokenHash === token)).toBe(false);
    expect(sessions.every((s) => /^[0-9a-f]{64}$/.test(s.tokenHash))).toBe(true);
  });

  it("requires a name and accepted terms to create a new account", async () => {
    const email = uniq("noterms");
    const { devCode } = await json(await call("/auth/request-code", { body: { email } }));
    const res = await call("/auth/verify", { body: { email, code: devCode } });
    expect(res.status).toBe(404);
    expect((await json(res)).error).toMatch(/Sign up first/);
  });

  it("logs an existing user in with just email + code", async () => {
    const { email, user } = await signUp("Returning Rita");
    // Another code can't be requested for 30s, so age the previous code out of the throttle window.
    await db.update(schema.loginCodes).set({ createdAt: new Date(Date.now() - 120_000) }).where(eq(schema.loginCodes.email, email));
    const { devCode } = await json(await call("/auth/request-code", { body: { email } }));
    const res = await call("/auth/verify", { body: { email, code: devCode } });
    expect(res.status).toBe(200);
    expect((await json(res)).user.id).toBe(user.id);
  });

  it("lets you log in again straight after a successful login, but still throttles unused codes", async () => {
    const { email } = await signUp("Quick Quinn");
    const again = await call("/auth/request-code", { body: { email } });
    expect(again.status).toBe(200); // previous code was used
    expect((await call("/auth/request-code", { body: { email } })).status).toBe(429); // this one is unused
  });

  it("codes are single-use", async () => {
    const email = uniq("once");
    const { devCode } = await json(await call("/auth/request-code", { body: { email } }));
    const body = { email, code: devCode, name: "Once", acceptedTerms: true };
    expect((await call("/auth/verify", { body })).status).toBe(200);
    expect((await call("/auth/verify", { body })).status).toBe(400);
  });

  it("locks out after too many wrong guesses, even if the right code is then used", async () => {
    const email = uniq("brute");
    const { devCode } = await json(await call("/auth/request-code", { body: { email } }));
    const wrong = devCode === "000000" ? "111111" : "000000";
    const body = { email, code: wrong, name: "Brute", acceptedTerms: true };
    for (let i = 0; i < 4; i++) expect((await call("/auth/verify", { body })).status).toBe(400);
    expect((await call("/auth/verify", { body })).status).toBe(400); // 5th wrong
    const late = await call("/auth/verify", { body: { ...body, code: devCode } });
    expect(late.status).toBe(429);
  });

  it("rejects expired codes and rate-limits code requests", async () => {
    const email = uniq("exp");
    const { devCode } = await json(await call("/auth/request-code", { body: { email } }));
    expect((await call("/auth/request-code", { body: { email } })).status).toBe(429); // too soon
    await db.update(schema.loginCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.loginCodes.email, email));
    const res = await call("/auth/verify", { body: { email, code: devCode, name: "Late", acceptedTerms: true } });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/expired/);

    const spam = uniq("spam");
    for (let i = 0; i < 5; i++)
      await db.insert(schema.loginCodes).values({ email: spam, codeHash: "x", expiresAt: new Date(Date.now() + 1000), createdAt: new Date(Date.now() - 120_000 + i) });
    expect((await call("/auth/request-code", { body: { email: spam } })).status).toBe(429);
  });

  it("in production without an email service, no code is leaked and login is unavailable", async () => {
    process.env.VERCEL = "1";
    process.env.AUTH_SECRET = "a-long-enough-secret-for-tests";
    try {
      const res = await call("/auth/request-code", { body: { email: uniq("prod") } });
      expect(res.status).toBe(503);
      expect(JSON.stringify(await json(res))).not.toMatch(/\d{6}/);
    } finally {
      delete process.env.VERCEL;
      delete process.env.AUTH_SECRET;
    }
  });

  it("logout ends the session; logout-all ends every session", async () => {
    const a = await signUp("Logout Lou");
    expect((await call("/auth/me", { cookie: a.cookie })).status).toBe(200);
    expect((await call("/auth/logout", { method: "POST", cookie: a.cookie, body: {} })).status).toBe(200);
    expect((await call("/auth/me", { cookie: a.cookie })).status).toBe(401);

    const email = uniq("multi");
    const first = await signUp("Multi", email);
    await db.update(schema.loginCodes).set({ createdAt: new Date(Date.now() - 120_000) }).where(eq(schema.loginCodes.email, email));
    const { devCode } = await json(await call("/auth/request-code", { body: { email } }));
    const second = cookieOf(await call("/auth/verify", { body: { email, code: devCode } }));
    expect((await call("/auth/logout-all", { cookie: first.cookie, body: {} })).status).toBe(200);
    expect((await call("/auth/me", { cookie: second })).status).toBe(401);
  });
});

describe("access control", () => {
  it("rejects anonymous users on personal routes", async () => {
    for (const [path, method] of [["/challenges/mine", "GET"], ["/challenges", "POST"], ["/join", "POST"], ["/lobby/x/join", "POST"], ["/challenges/x", "GET"]] as const) {
      const res = await call(path, { method, ...(method === "POST" ? { body: { name: "n", inviteCode: "ABCD1234" } } : {}) });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
    expect((await call("/lobby")).status).toBe(200); // browsing is public
    expect((await call("/merchants")).status).toBe(200);
  });

  it("creates and joins as the logged-in user, never as a name/email sent by the client", async () => {
    const host = await signUp("Host Hana");
    const guest = await signUp("Guest Gus");
    const created = await json(await call("/challenges", { cookie: host.cookie, body: { name: "Mine", creator: { name: "Mallory", email: "mallory@evil.test" } } }));
    expect(created.userId).toBe(host.user.id);
    const joined = await json(await call("/join", { cookie: guest.cookie, body: { inviteCode: created.inviteCode, name: "Mallory", email: "mallory@evil.test" } }));
    expect(joined.userId).toBe(guest.user.id);
    const mine = await json(await call("/challenges/mine", { cookie: guest.cookie }));
    expect(mine).toHaveLength(1);
    expect(JSON.stringify(await json(await call(`/challenges/${created.challengeId}`, { cookie: host.cookie })))).not.toMatch(/mallory/i);
  });

  it("non-members can't read or change a challenge; only the host can cancel", async () => {
    const host = await signUp("Host Hal");
    const guest = await signUp("Guest Gil");
    const outsider = await signUp("Outsider Ola");
    const c = await json(await call("/challenges", { cookie: host.cookie, body: { name: "Private-ish" } }));
    await call("/join", { cookie: guest.cookie, body: { inviteCode: c.inviteCode } });

    for (const [path, method] of [[`/challenges/${c.challengeId}`, "GET"], [`/challenges/${c.challengeId}/cancel`, "POST"], [`/challenges/${c.challengeId}/settle`, "POST"], [`/challenges/${c.challengeId}/simulate-activity`, "POST"]] as const) {
      const res = await call(path, { method, cookie: outsider.cookie, ...(method === "POST" ? { body: {} } : {}) });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect((await call(`/challenges/${c.challengeId}/cancel`, { cookie: guest.cookie, body: {} })).status).toBe(403);
    expect((await call(`/challenges/${c.challengeId}/cancel`, { cookie: host.cookie, body: {} })).status).toBe(200);
  });

  it("blocks cross-site posts", async () => {
    const u = await signUp("Origin Ori");
    const res = await call("/challenges", { cookie: u.cookie, body: { name: "x" }, headers: { origin: "https://evil.example", host: "fitstake.test" } });
    expect(res.status).toBe(403);
    const ok = await call("/challenges", { cookie: u.cookie, body: { name: "x" }, headers: { origin: "https://fitstake.test", host: "fitstake.test" } });
    expect(ok.status).toBe(201);
  });
});
