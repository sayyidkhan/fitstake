import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { DB } from "./db/client.js";
import * as t from "./db/schema.js";
import { emailConfigured, sendEmail } from "./email.js";
import { TERMS_VERSION } from "./legal.js";
import { HttpError } from "./service.js";

export type AuthUser = { id: string; name: string; email: string };
export type Mailer = (to: string, subject: string, text: string) => Promise<boolean>;

const CODE_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 30 * 86_400_000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const MIN_RESEND_MS = 30_000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const normaliseEmail = (e: string) => e.trim().toLowerCase();

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Demo mode shows the code on screen, so the hashing secret protects nothing there. Real email login must have one.
  if (process.env.VERCEL && !devCodeAllowed()) throw new HttpError(503, "Login isn’t configured yet: AUTH_SECRET is missing or too short.");
  return "local-dev-secret-not-for-production";
}
const hashCode = (email: string, code: string) => sha256(`${secret()}:${email}:${code}`);

// Local dev and explicit demo mode can show the code on screen instead of emailing it. Never enabled by default on Vercel.
export const devCodeAllowed = () =>
  process.env.AUTH_DEV_CODE === "true" || (!process.env.VERCEL && !emailConfigured());

export async function requestLoginCode(db: DB, rawEmail: string, mail: Mailer = sendEmail) {
  const email = normaliseEmail(rawEmail);
  const now = Date.now();
  const recent = await db
    .select({ createdAt: t.loginCodes.createdAt, consumedAt: t.loginCodes.consumedAt })
    .from(t.loginCodes)
    .where(and(eq(t.loginCodes.email, email), gt(t.loginCodes.createdAt, new Date(now - 3_600_000))))
    .orderBy(desc(t.loginCodes.createdAt), sql`rowid desc`); // rowid breaks same-second ties
  if (recent.length >= MAX_CODES_PER_HOUR) throw new HttpError(429, "Too many codes requested. Please try again in an hour.");
  // The short wait only applies while the last code is still unused; after a successful login you can log in again right away.
  if (recent[0] && !recent[0].consumedAt && now - recent[0].createdAt.getTime() < MIN_RESEND_MS)
    throw new HttpError(429, "Please wait a few seconds before requesting another code.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(t.loginCodes).values({ email, codeHash: hashCode(email, code), expiresAt: new Date(now + CODE_TTL_MS) });

  const sent = await mail(
    email,
    `Your FitStake code: ${code}`,
    `Your FitStake login code is ${code}.\n\nIt expires in 10 minutes. If you didn’t ask for it, you can ignore this email.`,
  );
  if (!sent && !devCodeAllowed()) throw new HttpError(503, "Email login isn’t set up yet. Please try again later.");
  return { devCode: !sent && devCodeAllowed() ? code : undefined };
}

export async function verifyLoginCode(
  db: DB,
  input: { email: string; code: string; name?: string; acceptedTerms?: boolean; userAgent?: string | null },
) {
  const email = normaliseEmail(input.email);
  const [row] = await db
    .select()
    .from(t.loginCodes)
    .where(and(eq(t.loginCodes.email, email), isNull(t.loginCodes.consumedAt), gt(t.loginCodes.expiresAt, new Date())))
    .orderBy(desc(t.loginCodes.createdAt), sql`rowid desc`)
    .limit(1);
  if (!row) throw new HttpError(400, "That code is invalid or has expired. Request a new one.");
  if (row.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong attempts. Request a new code.");

  const a = Buffer.from(hashCode(email, input.code.trim()));
  const b = Buffer.from(row.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(t.loginCodes).set({ attempts: sql`${t.loginCodes.attempts} + 1` }).where(eq(t.loginCodes.id, row.id));
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new HttpError(400, left > 0 ? `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong attempts. Request a new code.");
  }
  // Single use: only one concurrent verification can consume the code.
  const consumed = await db
    .update(t.loginCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(t.loginCodes.id, row.id), isNull(t.loginCodes.consumedAt)))
    .returning({ id: t.loginCodes.id });
  if (!consumed.length) throw new HttpError(400, "That code has already been used.");

  let [user] = await db.select().from(t.users).where(eq(t.users.email, email));
  if (!user) {
    const name = input.name?.trim();
    if (!name || input.acceptedTerms !== true)
      throw new HttpError(404, "No account found for that email. Sign up first.");
    [user] = await db
      .insert(t.users)
      .values({ name: name.slice(0, 60), email, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date(), emailVerifiedAt: new Date() })
      .returning();
  } else {
    const patch: Partial<typeof t.users.$inferInsert> = {};
    if (!user.emailVerifiedAt) patch.emailVerifiedAt = new Date();
    if (!user.termsAcceptedAt && input.acceptedTerms === true) {
      patch.termsAcceptedAt = new Date();
      patch.termsVersion = TERMS_VERSION;
    }
    if (Object.keys(patch).length) await db.update(t.users).set(patch).where(eq(t.users.id, user.id));
  }
  const token = await createSession(db, user!.id, input.userAgent);
  return { token, user: { id: user!.id, name: user!.name, email: user!.email } satisfies AuthUser };
}

export async function createSession(db: DB, userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(t.sessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: userAgent?.slice(0, 200),
  });
  return token;
}

export async function getSessionUser(db: DB, token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: t.users.id, name: t.users.name, email: t.users.email })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(and(eq(t.sessions.tokenHash, sha256(token)), gt(t.sessions.expiresAt, new Date())));
  return row ?? null;
}

export const destroySession = (db: DB, token: string) =>
  db.delete(t.sessions).where(eq(t.sessions.tokenHash, sha256(token)));

export const destroyAllSessions = (db: DB, userId: string) =>
  db.delete(t.sessions).where(eq(t.sessions.userId, userId));
