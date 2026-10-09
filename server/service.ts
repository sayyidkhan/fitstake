import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "./db/client";
import * as t from "./db/schema";
import { findProduct } from "./merchants";
import { getReap, type CheckoutResult, type ReapClient } from "./reap";
import { decide, rank, scoreUser } from "./scoring";

export class HttpError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) {
    super(message);
  }
}

const ENROLLMENT_DAYS = 365;

async function upsertUser(db: DB, name: string, email: string) {
  const e = email.trim().toLowerCase();
  const [existing] = await db.select().from(t.users).where(eq(t.users.email, e));
  if (existing) return existing;
  const [created] = await db.insert(t.users).values({ name: name.trim(), email: e }).returning();
  return created!;
}

export async function createChallenge(db: DB, input: { name: string; creator: { name: string; email: string } }) {
  const user = await upsertUser(db, input.creator.name, input.creator.email);
  const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const [challenge] = await db.insert(t.challenges).values({ name: input.name, inviteCode }).returning();
  await db.insert(t.participants).values({ challengeId: challenge!.id, userId: user.id });
  return { challengeId: challenge!.id, userId: user.id, inviteCode };
}

export async function joinChallenge(db: DB, inviteCode: string, input: { name: string; email: string }) {
  const [challenge] = await db.select().from(t.challenges).where(eq(t.challenges.inviteCode, inviteCode.toUpperCase()));
  if (!challenge) throw new HttpError(404, "Invite code not found");
  const user = await upsertUser(db, input.name, input.email);
  const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challenge.id));
  if (people.some((p) => p.userId === user.id)) return { challengeId: challenge.id, userId: user.id };
  if (people.length >= 2) throw new HttpError(409, "Challenge is full (1-vs-1)");
  await db.insert(t.participants).values({ challengeId: challenge.id, userId: user.id });
  return { challengeId: challenge.id, userId: user.id };
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
  const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challengeId));
  await db.delete(t.activityLogs).where(eq(t.activityLogs.challengeId, challengeId));
  const rows = people.flatMap((p) => {
    const seed = [...(c.id + p.userId)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);
    const rand = mulberry32(seed);
    return Array.from({ length: c.durationDays }, (_, i) => {
      const activeMinutes = Math.round(15 + rand() * 60);
      return { challengeId, userId: p.userId, day: i + 1, activeMinutes, steps: Math.round(activeMinutes * (90 + rand() * 40)) };
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

// Day 30 checkouts may wait on the payer's hosted approval; sync their status from Reap.
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
  return process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");
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
    participants: people.map((p) => ({
      user: users.find((u) => u.id === p.userId)!,
      rewards: rewards.filter((r) => r.userId === p.userId),
      authorised: auths.some((a) => a.userId === p.userId && a.status === "active"),
      enrolmentPending: auths.some((a) => a.userId === p.userId && a.status === "pending"),
    })),
    leaderboard: scores,
    transactions,
  };
}
