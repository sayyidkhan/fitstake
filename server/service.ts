import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "./db/client.js";
import * as t from "./db/schema.js";
import { TERMS_VERSION } from "./legal.js";
import { findProduct } from "./merchants.js";
import { getActivity } from "../shared/activities.js";
import { getReap, type CheckoutResult, type ReapClient } from "./reap.js";
import { decide, rank, scoreUser } from "./scoring.js";

export class HttpError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

const ENROLLMENT_DAYS = 365;

// Every create/join is an explicit acceptance of the current Terms and Privacy Notice.
async function upsertUser(db: DB, name: string, email: string) {
  const e = email.trim().toLowerCase();
  const acceptance = { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() };
  const [existing] = await db.select().from(t.users).where(eq(t.users.email, e));
  if (existing) {
    await db.update(t.users).set(acceptance).where(eq(t.users.id, existing.id));
    return { ...existing, ...acceptance };
  }
  const [created] = await db
    .insert(t.users)
    .values({ name: name.trim(), email: e, ...acceptance })
    .returning();
  return created!;
}

export async function createChallenge(db: DB, input: { name: string; creator: { name: string; email: string }; durationDays?: number; activity?: string; isPublic?: boolean }) {
  const user = await upsertUser(db, input.creator.name, input.creator.email);
  const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const [challenge] = await db.insert(t.challenges).values({ name: input.name, inviteCode, durationDays: input.durationDays ?? 30, activity: input.activity ?? "any", isPublic: input.isPublic ?? true }).returning();
  await db.insert(t.participants).values({ challengeId: challenge!.id, userId: user.id });
  return { challengeId: challenge!.id, userId: user.id, inviteCode };
}

const MAX_PLAYERS = 2;

// Single atomic statement so two simultaneous joins can never overfill a challenge.
async function addParticipant(db: DB, challengeId: string, userId: string) {
  const res = await db.run(sql`
    INSERT INTO participants (id, challenge_id, user_id)
    SELECT ${crypto.randomUUID()}, ${challengeId}, ${userId}
    WHERE (SELECT COUNT(*) FROM participants WHERE challenge_id = ${challengeId}) < ${MAX_PLAYERS}`);
  if (res.rowsAffected === 0) throw new HttpError(409, "That challenge is already full");
}

async function joinExisting(db: DB, challenge: typeof t.challenges.$inferSelect, input: { name: string; email: string }) {
  if (challenge.status === "cancelled") throw new HttpError(409, "That challenge was cancelled");
  if (challenge.status !== "draft") throw new HttpError(409, "That challenge has already started");
  const user = await upsertUser(db, input.name, input.email);
  const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challenge.id));
  if (people.some((p) => p.userId === user.id)) return { challengeId: challenge.id, userId: user.id };
  await addParticipant(db, challenge.id, user.id);
  return { challengeId: challenge.id, userId: user.id };
}

// Join with an invite code (works for private and public challenges).
export async function joinChallenge(db: DB, inviteCode: string, input: { name: string; email: string }) {
  const [challenge] = await db.select().from(t.challenges).where(eq(t.challenges.inviteCode, inviteCode.toUpperCase()));
  if (!challenge) throw new HttpError(404, "Invite code not found");
  return joinExisting(db, challenge, input);
}

// Join a challenge picked from the lobby. Only public challenges can be joined without a code.
export async function joinPublicChallenge(db: DB, challengeId: string, input: { name: string; email: string }) {
  const [challenge] = await db.select().from(t.challenges).where(eq(t.challenges.id, challengeId));
  if (!challenge || !challenge.isPublic) throw new HttpError(404, "Challenge not found");
  return joinExisting(db, challenge, input);
}

// Open public challenges with a free seat, newest first. Full or started ones are not listed.
export async function listLobby(db: DB, activity?: string) {
  const rows = await db
    .select({
      id: t.challenges.id,
      name: t.challenges.name,
      activity: t.challenges.activity,
      durationDays: t.challenges.durationDays,
      createdAt: t.challenges.createdAt,
      players: sql<number>`(SELECT COUNT(*) FROM participants p WHERE p.challenge_id = challenges.id)`,
      host: sql<string>`(SELECT u.name FROM participants p JOIN users u ON u.id = p.user_id WHERE p.challenge_id = challenges.id ORDER BY p.created_at, p.rowid LIMIT 1)`,
    })
    .from(t.challenges)
    .where(
      and(
        eq(t.challenges.status, "draft"),
        eq(t.challenges.isPublic, true),
        activity ? eq(t.challenges.activity, activity) : undefined,
        sql`(SELECT COUNT(*) FROM participants p WHERE p.challenge_id = challenges.id) < ${MAX_PLAYERS}`,
        sql`(SELECT COUNT(*) FROM participants p WHERE p.challenge_id = challenges.id) >= 1`,
      ),
    )
    .orderBy(desc(t.challenges.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    activity: r.activity,
    durationDays: r.durationDays,
    host: (r.host ?? "Someone").split(" ")[0],
    players: Number(r.players),
    maxPlayers: MAX_PLAYERS,
  }));
}

async function requireParticipant(db: DB, challengeId: string, userId: string) {
  const [p] = await db
    .select()
    .from(t.participants)
    .where(and(eq(t.participants.challengeId, challengeId), eq(t.participants.userId, userId)));
  if (!p) throw new HttpError(404, "Not a participant of this challenge");
}

async function requireStatus(db: DB, challengeId: string, ...allowed: string[]) {
  const [c] = await db.select().from(t.challenges).where(eq(t.challenges.id, challengeId));
  if (!c) throw new HttpError(404, "Challenge not found");
  if (!allowed.includes(c.status)) throw new HttpError(409, `Challenge is ${c.status}`);
  return c;
}

export async function lockRewards(db: DB, challengeId: string, userId: string, lowestId: string, bestId: string) {
  await requireStatus(db, challengeId, "draft");
  await requireParticipant(db, challengeId, userId);
  const lowest = findProduct(lowestId);
  const best = findProduct(bestId);
  if (!lowest || !best) throw new HttpError(400, "Unsupported product");
  if (lowest.priceCents >= best.priceCents) throw new HttpError(400, "Best reward must cost more than the lowest reward");
  const existing = await db
    .select()
    .from(t.rewardChoices)
    .where(and(eq(t.rewardChoices.challengeId, challengeId), eq(t.rewardChoices.userId, userId)));
  if (existing.length) throw new HttpError(409, "Rewards are locked and cannot be changed");
  await db.insert(t.rewardChoices).values(
    ([["lowest", lowest], ["best", best]] as const).map(([tier, p]) => ({
      challengeId,
      userId,
      tier,
      productId: p.id,
      merchant: p.merchant,
      productName: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
    })),
  );
  await maybeActivate(db, challengeId);
}

export async function authorize(
  db: DB,
  challengeId: string,
  userId: string,
  ceilingCents: number,
  returnUrl: string,
  reap: ReapClient = getReap(),
) {
  await requireStatus(db, challengeId, "draft");
  await requireParticipant(db, challengeId, userId);
  const [existing] = await db
    .select()
    .from(t.paymentAuthorizations)
    .where(and(eq(t.paymentAuthorizations.challengeId, challengeId), eq(t.paymentAuthorizations.userId, userId)));
  if (existing?.status === "active") throw new HttpError(409, "Already authorised");
  const [user] = await db.select().from(t.users).where(eq(t.users.id, userId));
  // Hosted card enrolment: card details never reach our server. Only the enrolment id and our own ceiling are stored.
  const enrollment = await reap.createEnrollment({
    userId,
    name: user!.name,
    email: user!.email,
    returnUrl,
    idempotencyKey: `enroll:${challengeId}:${userId}:${existing ? Date.now() : 0}`,
  });
  const row = {
    providerRef: enrollment.enrollmentId,
    spendingCeilingCents: ceilingCents,
    validUntil: new Date(Date.now() + ENROLLMENT_DAYS * 86_400_000),
    status: enrollment.active ? ("active" as const) : ("pending" as const),
  };
  if (existing) await db.update(t.paymentAuthorizations).set(row).where(eq(t.paymentAuthorizations.id, existing.id));
  else await db.insert(t.paymentAuthorizations).values({ challengeId, userId, ...row });
  await maybeActivate(db, challengeId);
  return { approvalUrl: enrollment.approvalUrl };
}

// Called after the user returns from the hosted card page.
export async function refreshEnrollment(db: DB, challengeId: string, userId: string, reap: ReapClient = getReap()) {
  const [auth] = await db
    .select()
    .from(t.paymentAuthorizations)
    .where(and(eq(t.paymentAuthorizations.challengeId, challengeId), eq(t.paymentAuthorizations.userId, userId)));
  if (!auth) throw new HttpError(404, "No enrolment started");
  if (auth.status === "pending") {
    const e = await reap.getEnrollment(auth.providerRef);
    if (e.active) {
      await db.update(t.paymentAuthorizations).set({ status: "active" }).where(eq(t.paymentAuthorizations.id, auth.id));
      await maybeActivate(db, challengeId);
    } else if (e.failed) {
      throw new HttpError(409, "Card enrolment failed or expired; authorise again");
    }
  }
}

async function maybeActivate(db: DB, challengeId: string) {
  const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challengeId));
  if (people.length !== 2) return;
  const rewards = await db.select().from(t.rewardChoices).where(eq(t.rewardChoices.challengeId, challengeId));
  const auths = await db.select().from(t.paymentAuthorizations).where(eq(t.paymentAuthorizations.challengeId, challengeId));
  const ready = people.every(
    (p) => rewards.filter((r) => r.userId === p.userId).length === 2 && auths.some((a) => a.userId === p.userId && a.status === "active"),
  );
  if (ready) {
    await db
      .update(t.challenges)
      .set({ status: "active", startedAt: new Date() })
      .where(and(eq(t.challenges.id, challengeId), eq(t.challenges.status, "draft")));
  }
}

// Seeded PRNG so simulated data is reproducible.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export async function simulateActivity(db: DB, challengeId: string) {
  const c = await requireStatus(db, challengeId, "active");
  const { stepsPerMinute } = getActivity(c.activity);
  const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challengeId));
  await db.delete(t.activityLogs).where(eq(t.activityLogs.challengeId, challengeId));
  const rows = people.flatMap((p) => {
    const seed = [...(c.id + p.userId)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);
    const rand = mulberry32(seed);
    return Array.from({ length: c.durationDays }, (_, i) => {
      const activeMinutes = Math.round(15 + rand() * 60);
      return { challengeId, userId: p.userId, day: i + 1, activeMinutes, steps: Math.round(activeMinutes * stepsPerMinute * (0.85 + rand() * 0.3)) };
    });
  });
  await db.insert(t.activityLogs).values(rows);
}

export async function settle(db: DB, challengeId: string, reap: ReapClient = getReap()) {
  const c = await requireStatus(db, challengeId, "active", "settled");
  if (c.status === "active") {
    const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challengeId));
    const logs = await db.select().from(t.activityLogs).where(eq(t.activityLogs.challengeId, challengeId));
    if (!logs.length) throw new HttpError(409, "No activity recorded yet");
    const scores = people.map((p) => scoreUser(p.userId, logs.filter((l) => l.userId === p.userId)));
    const { winner, loser } = decide(challengeId, scores);
    // Only one concurrent settle wins this transition.
    await db
      .update(t.challenges)
      .set({ status: "settled", settledAt: new Date(), winnerUserId: winner.userId, loserUserId: loser.userId })
      .where(and(eq(t.challenges.id, challengeId), eq(t.challenges.status, "active")));
  }
  const [settled] = await db.select().from(t.challenges).where(eq(t.challenges.id, challengeId));
  const { winnerUserId, loserUserId } = settled!;
  if (!winnerUserId || !loserUserId) throw new HttpError(409, "Challenge has no result");

  const rewards = await db.select().from(t.rewardChoices).where(eq(t.rewardChoices.challengeId, challengeId));
  const plan = [
    { payer: loserUserId, recipient: winnerUserId, reward: rewards.find((r) => r.userId === winnerUserId && r.tier === "best")! },
    { payer: winnerUserId, recipient: loserUserId, reward: rewards.find((r) => r.userId === loserUserId && r.tier === "lowest")! },
  ];
  for (const step of plan) {
    const key = `${challengeId}:${step.reward.id}`;
    await db
      .insert(t.transactions)
      .values({
        challengeId,
        payerUserId: step.payer,
        recipientUserId: step.recipient,
        rewardChoiceId: step.reward.id,
        idempotencyKey: key,
      })
      .onConflictDoNothing();
    await runCheckout(db, key, step.reward.productId, reap);
  }
}

async function fail(db: DB, id: string, reason: string) {
  await db.update(t.transactions).set({ status: "failed", failureReason: reason }).where(eq(t.transactions.id, id));
}

async function runCheckout(db: DB, key: string, productId: string, reap: ReapClient) {
  // Claim the row; a concurrent or repeated call finds nothing to claim and does not buy again.
  const [claimed] = await db
    .update(t.transactions)
    .set({ status: "processing", failureReason: null })
    .where(and(eq(t.transactions.idempotencyKey, key), inArray(t.transactions.status, ["pending", "failed"])))
    .returning();
  if (!claimed) return;
  const attempt = claimed.attempts + 1;
  await db.update(t.transactions).set({ attempts: attempt }).where(eq(t.transactions.id, claimed.id));
  const providerKey = `${key}:${attempt}`;
  try {
    const product = findProduct(productId);
    if (!product) return fail(db, claimed.id, "Product no longer supported");
    const [auth] = await db
      .select()
      .from(t.paymentAuthorizations)
      .where(and(eq(t.paymentAuthorizations.challengeId, claimed.challengeId), eq(t.paymentAuthorizations.userId, claimed.payerUserId)));
    if (!auth || auth.status !== "active") return fail(db, claimed.id, "Card not enrolled; payer must authorise again");
    const [payer] = await db.select().from(t.users).where(eq(t.users.id, claimed.payerUserId));
    const quote = await reap.quote({ product, email: payer!.email, idempotencyKey: providerKey });
    if (quote.amountCents > auth.spendingCeilingCents) return fail(db, claimed.id, "Quote exceeds authorised spending ceiling");
    const res = await reap.checkout({ quote, enrollmentId: auth.providerRef, returnUrl: appUrl(), idempotencyKey: providerKey });
    await applyCheckout(db, claimed.id, res, quote.amountCents, quote.currency);
  } catch (err) {
    await fail(db, claimed.id, err instanceof Error ? err.message : "Checkout error");
  }
}

async function applyCheckout(db: DB, id: string, res: CheckoutResult, amountCents?: number, currency?: string) {
  if (res.status === "failed") return fail(db, id, res.reason ?? "Checkout failed");
  await db
    .update(t.transactions)
    .set({
      status: res.status,
      providerRef: res.providerRef,
      checkoutUrl: res.status === "requires_approval" ? res.approvalUrl ?? null : null,
      ...(res.amountCents ?? amountCents ? { amountCents: res.amountCents ?? amountCents } : {}),
      ...(currency ? { currency } : {}),
    })
    .where(eq(t.transactions.id, id));
}

// Final-day checkouts may wait on the payer's hosted approval; sync their status from Reap.
export async function refreshTransactions(db: DB, challengeId: string, reap: ReapClient = getReap()) {
  const open = await db
    .select()
    .from(t.transactions)
    .where(and(eq(t.transactions.challengeId, challengeId), inArray(t.transactions.status, ["requires_approval", "checkout_opened"])));
  for (const tx of open) {
    if (!tx.providerRef) continue;
    try {
      await applyCheckout(db, tx.id, await reap.getCheckout(tx.providerRef));
    } catch {
      // leave as-is; the next refresh retries
    }
  }
}

function appUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return process.env.APP_URL ?? (host ? `https://${host}` : "http://localhost:5173");
}

function toPublicUser(u: { id: string; name: string }) {
  return { id: u.id, name: u.name };
}

// The host is whoever created the challenge: its first participant.
async function hostOf(db: DB, challengeId: string): Promise<string | undefined> {
  const [first] = await db
    .select({ userId: t.participants.userId })
    .from(t.participants)
    .where(eq(t.participants.challengeId, challengeId))
    .orderBy(sql`created_at, rowid`)
    .limit(1);
  return first?.userId;
}

// Only the host can cancel, and only before the challenge starts. Nothing has been charged by then.
export async function cancelChallenge(db: DB, challengeId: string, userId: string) {
  const [challenge] = await db.select().from(t.challenges).where(eq(t.challenges.id, challengeId));
  if (!challenge) throw new HttpError(404, "Challenge not found");
  if ((await hostOf(db, challengeId)) !== userId) throw new HttpError(403, "Only the host can cancel this challenge");
  if (challenge.status === "cancelled") return;
  if (challenge.status !== "draft") throw new HttpError(409, "A challenge that has started can’t be cancelled");
  await db
    .update(t.challenges)
    .set({ status: "cancelled" })
    .where(and(eq(t.challenges.id, challengeId), eq(t.challenges.status, "draft")));
}

export async function getState(db: DB, challengeId: string) {
  const [challenge] = await db.select().from(t.challenges).where(eq(t.challenges.id, challengeId));
  if (!challenge) throw new HttpError(404, "Challenge not found");
  const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challengeId));
  const users = people.length
    ? await db.select().from(t.users).where(inArray(t.users.id, people.map((p) => p.userId)))
    : [];
  const rewards = await db.select().from(t.rewardChoices).where(eq(t.rewardChoices.challengeId, challengeId));
  const auths = await db.select().from(t.paymentAuthorizations).where(eq(t.paymentAuthorizations.challengeId, challengeId));
  const logs = await db.select().from(t.activityLogs).where(eq(t.activityLogs.challengeId, challengeId));
  const transactions = await db.select().from(t.transactions).where(eq(t.transactions.challengeId, challengeId));
  const scores = rank(
    challengeId,
    people.map((p) => scoreUser(p.userId, logs.filter((l) => l.userId === p.userId))),
  );
  return {
    challenge,
    hostUserId: await hostOf(db, challengeId),
    participants: people.map((p) => ({
      // Only the name is public to other participants; emails stay private.
      user: toPublicUser(users.find((u) => u.id === p.userId)!),
      rewards: rewards.filter((r) => r.userId === p.userId),
      authorised: auths.some((a) => a.userId === p.userId && a.status === "active"),
      enrolmentPending: auths.some((a) => a.userId === p.userId && a.status === "pending"),
    })),
    leaderboard: scores,
    transactions,
  };
}
