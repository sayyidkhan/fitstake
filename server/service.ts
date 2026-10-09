import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "./db/client";
import * as t from "./db/schema";
import { findProduct } from "./merchants";
import { getReap, type ReapClient } from "./reap";
import { decide, rank, scoreUser } from "./scoring";

export class HttpError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) {
    super(message);
  }
}

const MANDATE_DAYS = 31;

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

export async function authorize(db: DB, challengeId: string, userId: string, ceilingCents: number, reap: ReapClient = getReap()) {
  await requireStatus(db, challengeId, "draft");
  await requireParticipant(db, challengeId, userId);
  const [existing] = await db
    .select()
    .from(t.paymentAuthorizations)
    .where(and(eq(t.paymentAuthorizations.challengeId, challengeId), eq(t.paymentAuthorizations.userId, userId)));
  if (existing) throw new HttpError(409, "Already authorised");
  const mandate = await reap.createMandate({ userId, spendingCeilingCents: ceilingCents, validDays: MANDATE_DAYS });
  // Only mandate terms are stored; card details stay with the provider.
  await db.insert(t.paymentAuthorizations).values({
    challengeId,
    userId,
    providerRef: mandate.providerRef,
    spendingCeilingCents: mandate.spendingCeilingCents,
    validUntil: mandate.validUntil,
  });
  await maybeActivate(db, challengeId);
}

async function maybeActivate(db: DB, challengeId: string) {
  const people = await db.select().from(t.participants).where(eq(t.participants.challengeId, challengeId));
  if (people.length !== 2) return;
  const rewards = await db.select().from(t.rewardChoices).where(eq(t.rewardChoices.challengeId, challengeId));
  const auths = await db.select().from(t.paymentAuthorizations).where(eq(t.paymentAuthorizations.challengeId, challengeId));
  const ready = people.every(
    (p) => rewards.filter((r) => r.userId === p.userId).length === 2 && auths.some((a) => a.userId === p.userId),
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
  const [tx] = await db
    .update(t.transactions)
    .set({ status: "processing", failureReason: null })
    .where(and(eq(t.transactions.idempotencyKey, key), inArray(t.transactions.status, ["pending", "failed"])))
    .returning();
  if (!tx) return;
  try {
    const product = findProduct(productId);
    if (!product) return fail(db, tx.id, "Product no longer supported");
    const [auth] = await db
      .select()
      .from(t.paymentAuthorizations)
      .where(and(eq(t.paymentAuthorizations.challengeId, tx.challengeId), eq(t.paymentAuthorizations.userId, tx.payerUserId)));
    if (!auth || auth.status !== "active" || auth.validUntil.getTime() < Date.now()) {
      return fail(db, tx.id, "Payment authorisation missing or expired; fresh approval required");
    }
    const quote = await reap.quote(product);
    if (!quote.available) return fail(db, tx.id, "Item unavailable");
    if (quote.amountCents > auth.spendingCeilingCents) return fail(db, tx.id, "Quote exceeds authorised spending ceiling");
    const res = await reap.checkout({ mandate: auth, quote, product, idempotencyKey: key });
    if (res.status === "failed") return fail(db, tx.id, res.reason);
    await db
      .update(t.transactions)
      .set({ status: res.status, providerRef: res.providerRef, checkoutUrl: res.checkoutUrl, amountCents: quote.amountCents, currency: quote.currency })
      .where(eq(t.transactions.id, tx.id));
  } catch (err) {
    await fail(db, tx.id, err instanceof Error ? err.message : "Checkout error");
  }
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
      authorised: auths.some((a) => a.userId === p.userId),
    })),
    leaderboard: scores,
    transactions,
  };
}
